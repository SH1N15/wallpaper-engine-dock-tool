// [COMBO] {"material":"Transform","combo":"TRANSFORM","type":"options","default":0}
// [COMBO] {"material":"Anti-Deformation","combo":"AD","type":"options","default":2,"options":{"Off":0,"Resolution":1,"Resolution + Scale":2}}
// [COMBO] {"material":"Horizontal Align","combo":"Z_H_ALIGN","type":"options","default":0,"options":{"Center":0,"Left":1,"Right":2}}
// [COMBO] {"material":"Vertical Align","combo":"Z_V_ALIGN","type":"options","default":0,"options":{"Center":0,"Top":1,"Bottom":2}}
// [COMBO] {"material":"Keep Square (Requires Anti-Deformation)","combo":"B_SQUARE","type":"options","default":1}

#include "common.h"

uniform mat4 g_ModelViewProjectionMatrix;
uniform mat4 g_LayerModelMatrix; // Added for layer scale correction

uniform vec2 u_Size; // {"default":"1 1","linked":true,"material":"Size","range":[0,1]}
uniform vec2 g_Offset; // {"default":"0 0","label":"ui_editor_properties_offset","material":"offset"}
uniform vec2 g_Scale; // {"default":"1 1","label":"ui_editor_properties_scale","material":"scale"}
uniform float g_Direction; // {"material":"angle","label":"ui_editor_properties_angle","default":0,"range":[0,6.28],"direction":true,"conversion":"rad2deg"}

uniform sampler2D g_Texture0; // {"material":"previous","label":"Prev","hidden":true}
uniform vec4 g_Texture0Resolution;

attribute vec3 a_Position;
attribute vec2 a_TexCoord;

varying vec4 v_TexCoord;
varying vec2 p_TexCoord;
varying vec2 v_Size;

vec2 applyFx(vec2 v, vec2 scale) {
    v.xy = rotateVec2(v - CAST2(0.5), -g_Direction);
    return (v + g_Offset) / scale + CAST2(0.5);
}

vec2 scaleFx(vec2 v, vec2 scale) {
    return (v - CAST2(0.5)) / scale + CAST2(0.5);
}

void main() {
    p_TexCoord = a_TexCoord;
    v_TexCoord.xy = a_TexCoord.xy;

#if AD != 0
    // --- Original resolution-based correction ---
    float xScale = max(1.0, g_Texture0Resolution.x / g_Texture0Resolution.y);
    float yScale = max(1.0, g_Texture0Resolution.y / g_Texture0Resolution.x);

    #if AD == 2
        // --- Retrieve scale from layer transformation matrix ---
        vec2 right = vec2(g_LayerModelMatrix[0][0], g_LayerModelMatrix[0][1]);
        vec2 up    = vec2(g_LayerModelMatrix[1][0], g_LayerModelMatrix[1][1]);
        vec2 layerScale = vec2(length(right), length(up));

        // --- Combine resolution correction with layer scale ---
        xScale *= layerScale.x;
        yScale *= layerScale.y;
    #endif

    v_TexCoord.x *= xScale;
    v_TexCoord.y *= yScale;
    v_TexCoord.zw = v_TexCoord.xy;

    #if B_SQUARE
        v_Size = u_Size;
    #else
        v_Size.x = u_Size.x * xScale;
        v_Size.y = u_Size.y * yScale;
    #endif
#else
    int xScale = 1;
    int yScale = 1;
    v_Size = u_Size;
#endif

    // Alignment corrections
#if Z_H_ALIGN == 0
    v_TexCoord.x -= (xScale - 1.0) * 0.5;
#endif
#if Z_H_ALIGN == 1
    v_TexCoord.x += (1.0 - v_Size.x) * 0.5;
#endif
#if Z_H_ALIGN == 2
    v_TexCoord.x -= xScale - 0.5 - (v_Size.x * 0.5);
#endif

#if Z_V_ALIGN == 0
    v_TexCoord.y -= (yScale - 1.0) * 0.5;
#endif
#if Z_V_ALIGN == 1
    v_TexCoord.y += (1.0 - v_Size.y) * 0.5;
#endif
#if Z_V_ALIGN == 2
    v_TexCoord.y -= yScale - 0.5 - (v_Size.y * 0.5);
#endif

#if TRANSFORM
    v_TexCoord.xy = applyFx(v_TexCoord.xy, g_Scale);
#if OPACITYMASK
    v_TexCoord.zw = applyFx(v_TexCoord.zw, 1);
    v_TexCoord.z /= xScale;
    v_TexCoord.w /= yScale;
    v_TexCoord.zw = scaleFx(v_TexCoord.zw, g_Scale);
#endif
#endif

    gl_Position = mul(vec4(a_Position, 1.0), g_ModelViewProjectionMatrix);
}
