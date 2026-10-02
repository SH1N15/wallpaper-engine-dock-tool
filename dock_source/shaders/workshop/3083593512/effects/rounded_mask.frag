// [COMBO] {"material":"Transparency","combo":"TRANSPARENCY","type":"options","default":4,"options":{"Preserve original":0,"Replace original":1,"Add to original":2,"Subtract from original":3,"Intersect original":4,"Fully opaque":5}}
// [COMBO] {"material":"Soft Edge","combo":"SOFT","type":"options","default":0}
// [COMBO] {"material":"Hollow (Larger border width require larger radius)","combo":"HOLLOW","type":"options","default":0}
// [COMBO] {"material":"Soft Edge Direction","combo":"SEDIRECTION","type":"options","default":0,"options":{"Inside":0,"Outside":1,"Both":2}}
// [COMBO] {"material":"ui_editor_properties_blend_mode","combo":"BLENDMODE","type":"imageblending","default":0}
// [COMBO] {"material":"Transparency only","combo":"C_ALPHA_ONLY","type":"options","default":1}
// [COMBO] {"material":"Invert opacity","combo":"INVERT","type":"options","default":0}

#include "common_blending.h"

uniform sampler2D g_Texture0; // {"material":"previous","label":"Prev","hidden":true}
uniform sampler2D g_Texture2; // {"combo":"OPACITYMASK","default":"util/white","label":"Radius Mask (Please disable \"Transform\" when editing)","mode":"opacitymask","paintdefaultcolor":"0 0 0 1"}

uniform vec3 u_Color; // {"default":"1 1 1","material":"Color","type":"color"}
uniform vec4 g_Texture0Resolution;
uniform float u_Radius; // {"material":"Radius","default":0.5,"range":[0.001,1]}
uniform float u_BorderWidth; // {"material":"Border width","default":0.025,"range":[0,0.25]}
uniform float u_Softness; // {"material":"Softness","int":false,"default":0.5,"range":[0,2]}
uniform float u_Alpha; // {"material":"ui_editor_properties_opacity","int":false,"default":1,"range":[0,1]}

varying vec2 p_TexCoord;
varying vec4 v_TexCoord;
varying vec2 v_Size;

float roundedBoxSDF(vec2 p, vec2 size, float radius) {
    size *= 0.5;
    float halfMin = min(size.x, size.y);

    // Clamp radius to a reasonable range to avoid sub-pixel collapse.
    float r = clamp(radius * halfMin, 0.001, halfMin);

    // Regular SDF core - FIX: float2 -> vec2
    vec2 d = abs(p) - (size - r);

    // If r is extremely small, fall back to a pure box SDF (no rounding).
    return (length(max(d, 0.0)) - r) * step(0.001, r) + max(abs(p.x) - size.x, abs(p.y) - size.y) * step(r, 0.001);
}

float roundedHollowBoxSDF(vec2 p, vec2 size, float radius, float border) {
    size *= 0.5;
    float halfMin = min(size.x, size.y);
    float r = clamp(radius * halfMin, 0.001, halfMin);
    
    // Ensure border doesn't exceed size
    float effectiveBorder = min(border, halfMin * 0.95);

    // Compute both outer and inner distances.
    float outer = roundedBoxSDF(p, size * 2.0, radius);
    
    // Calculate inner size, ensuring it's valid
    vec2 innerSize = size - vec2(effectiveBorder, effectiveBorder);
    
    int isNormal = step(innerSize.x, 0.001) * step(innerSize.y, 0.001);
    return isNormal * max(outer, -roundedBoxSDF(p, innerSize * 2.0, radius)) + (1 - isNormal) * outer;
}

void main() {
    vec4 pix = texSample2D(g_Texture0, p_TexCoord);

    // --- Normalize texture coordinates if Anti-Deformation scaled them ---
    vec2 uv = v_TexCoord.xy;

    // --- Compute Signed Distance Field ---
#if OPACITYMASK
    #if TRANSFORM
        float radius = texSample2D(g_Texture2, v_TexCoord.zw).r;
    #else
        float radius = texSample2D(g_Texture2, p_TexCoord).r;
    #endif
    #if HOLLOW == 1
        float d = roundedHollowBoxSDF(uv - vec2(0.5, 0.5), v_Size, radius, u_BorderWidth);
    #else
        float d = roundedBoxSDF(uv - vec2(0.5, 0.5), v_Size, radius);
    #endif
#else
    #if HOLLOW == 1
        float d = roundedHollowBoxSDF(uv - vec2(0.5, 0.5), v_Size, u_Radius, u_BorderWidth);
    #else
        float d = roundedBoxSDF(uv - vec2(0.5, 0.5), v_Size, u_Radius);
    #endif
#endif

    // --- Soft edge control ---
#if SOFT == 0
    #if HOLLOW == 1
        float rAlpha = step(abs(d), u_BorderWidth);
    #else
        float rAlpha = 1.0 - step(0.0, d);
    #endif
#else
    #if SEDIRECTION == 0
        float edgeSoftnessI = u_Softness / max(g_Texture0Resolution.x, g_Texture0Resolution.y) * 2.0;
        float edgeSoftnessO = 0.0;
    #endif
    #if SEDIRECTION == 1
        float edgeSoftnessI = 0.0;
        float edgeSoftnessO = u_Softness / max(g_Texture0Resolution.x, g_Texture0Resolution.y) * 2.0;
    #endif
    #if SEDIRECTION == 2
        float edgeSoftnessI = u_Softness / max(g_Texture0Resolution.x, g_Texture0Resolution.y);
        float edgeSoftnessO = edgeSoftnessI;
    #endif
    #if HOLLOW == 1
        float rAlpha = smoothstep(u_BorderWidth + edgeSoftnessO, u_BorderWidth - edgeSoftnessI, abs(d));
    #else
        float rAlpha = smoothstep(edgeSoftnessI, -edgeSoftnessO, d);
    #endif
#endif

    // --- Transparency blending modes ---
#if TRANSPARENCY == 0
    float alpha = pix.a;
#endif
#if TRANSPARENCY == 1
    float alpha = rAlpha * u_Alpha;
#endif
#if TRANSPARENCY == 2
    float alpha = max(pix.a, rAlpha * u_Alpha);
#endif
#if TRANSPARENCY == 3
    float alpha = max(0.0, pix.a - rAlpha * u_Alpha);
#endif
#if TRANSPARENCY == 4
    float alpha = pix.a * rAlpha * u_Alpha;
#endif
#if TRANSPARENCY == 5
    float alpha = u_Alpha;
#endif

    // --- Optional inversion ---
#if INVERT
    alpha = 1.0 - alpha;
    #if C_ALPHA_ONLY == 0
        rAlpha = 1.0 - rAlpha;
    #endif
#endif

    // --- Final output ---
#if C_ALPHA_ONLY
    gl_FragColor = vec4(pix.rgb, alpha);
#else
    gl_FragColor = vec4(ApplyBlending(BLENDMODE, u_Color, mix(u_Color, pix.rgb, pix.a), alpha), rAlpha);
#endif
}
