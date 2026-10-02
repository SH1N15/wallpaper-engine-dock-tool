// [COMBO] {"material":"ui_editor_properties_blend_mode","combo":"BLENDMODE","type":"imageblending","default":0}
// [COMBO] {"material":"ui_editor_effect_color_key_title","combo":"CLIPCOLOR","type":"options","default":0}
// [COMBO] {"material":"ui_editor_properties_repeat","combo":"REPEAT","type":"options","default":0}
// [COMBO] {"material":"Blend transparency","combo":"TRANSPARENCY","type":"options","default":0,"options":{"ui_editor_blending_normal":0,"ui_editor_properties_replace":1,"ui_browse_context_menu_remove":2,"ui_editor_blending_add":3,"ui_editor_properties_min":4,"ui_editor_blending_multiply":5,"Burn":6,"ui_editor_properties_max":7,"ui_editor_blending_screen":8,"Dodge":9,"ui_editor_blending_overlay":10,"ui_editor_blending_difference":11,"ui_editor_blending_exclusion":12,"ui_editor_blending_subtract":13,"ui_editor_blending_reflect":14,"ui_editor_blending_phoenix":15,"ui_editor_blending_average":16,"ui_editor_blending_negation":17}}

#include "common_blending.h"

uniform sampler2D g_Texture0; // {"material":"framebuffer","label":"ui_editor_properties_framebuffer","hidden":true}
uniform sampler2D g_Texture1; // {"combo":"TEX","label":"ui_editor_properties_texture","material":"texture"}
uniform sampler2D g_Texture2; // {"combo":"MASK","label":"ui_editor_properties_opacity_mask","material":"mask","mode":"opacitymask","paintdefaultcolor":"0 0 0 1"}
uniform sampler2D g_Texture3; // {"default":"_rt_FullFrameBuffer","hidden":true,"material":"backgroundTexture"}

uniform vec3 u_baseColor; // {"default":"1 1 1","group":"ui_editor_effect_color_key_title","label":"ui_editor_properties_color","material":"color","type":"color"}
uniform float u_fuzziness; // {"material":"weight","label":"ui_editor_properties_fuzziness","default":1,"range":[0,5],"group":"ui_editor_effect_color_key_title"}
uniform float u_tollerance; // {"material":"threshold","label":"ui_editor_properties_tolerance","default":1,"range":[0,5],"group":"ui_editor_effect_color_key_title"}
uniform float u_alpha; // {"material":"0opacity","label":"ui_editor_properties_opacity","default":1,"range":[0,1]}

varying vec4 v_TexCoord;
varying vec3 v_ScreenCoord;

float BlendTransparency(float base, float blend, float opacity){
    float transparency = base; //normal transparency
#if TRANSPARENCY == 1
    transparency = blend; //replace transparency
#endif
#if TRANSPARENCY == 2
    transparency = 1.0; //remove transparency
#endif
#if TRANSPARENCY == 3
    transparency = saturate(base + blend); //add transparency
#endif
#if TRANSPARENCY == 4
    transparency = min(base, blend); //Minimum transparency
#endif
#if TRANSPARENCY == 5
    transparency = base * blend; //multiply transparency
#endif
#if TRANSPARENCY == 6
    transparency = (blend == 0.0) ? blend : max((1.0 - ((1.0 - base) / blend)), 0.0); //Burn transparency
#endif
#if TRANSPARENCY == 7
    transparency = max(base, blend); //Maximum transparency
#endif
#if TRANSPARENCY == 8
    transparency = 1.0 - (1.0 - base) * (1.0 - blend); //Screen transparency
#endif
#if TRANSPARENCY == 9
    transparency = (blend == 1.0) ? blend : min(base / (1.0 - blend), 1.0); //Dodge transparency
#endif
#if TRANSPARENCY == 10
    transparency = base < 0.5 ? (2.0 * base * blend) : (1.0 - 2.0 * (1.0 - base) * (1.0 - blend)); //Overlay transparency
#endif
#if TRANSPARENCY == 11
    transparency = saturate(base - blend); //Difference transparency
#endif
#if TRANSPARENCY == 12
    transparency = base + blend - 2.0 * base + blend; //Exclusion transparency
#endif
#if TRANSPARENCY == 13
    transparency = saturate(base + blend - 1.0); //subtract transparency
#endif
#if TRANSPARENCY == 14
    transparency = (blend == 1.0) ? blend : min(base * base / (1.0 - blend), 1.0); //Reflect transparency
#endif
#if TRANSPARENCY == 15
    transparency = min(base, blend) - max(base, blend) + 1.0; //Phoenix transparency
#endif
#if TRANSPARENCY == 16
    transparency = (base + blend) / 2.0; //Average transparency
#endif
#if TRANSPARENCY == 17
    transparency = 1.0 - abs(1.0 - base - blend); //Negation transparency
#endif
    return mix(base, transparency, opacity);
}

#if CLIPCOLOR
float chromaKey(vec4 color, vec4 clip){
	float delta = dot(abs(u_baseColor - color.rgb), CAST3(1.0));
	return smoothstep(0.001, 0.002 + u_fuzziness, (u_tollerance - delta));
}
#endif

void main() {
	vec4 albedo = texSample2D(g_Texture0, v_TexCoord.xy);
	
#if TEX //if there's a texture

#if REPEAT
	vec2 coord = mod(v_TexCoord.zw, CAST2(1.0));
	const vec2 clampUV = CAST2(1.0);
#else
#define coord v_TexCoord.zw
	vec2 clampUV = step(abs(floor(v_TexCoord.zw)) + 0.001, CAST2(1.0));
#endif

	vec4 clip = texSample2D(g_Texture1, coord);

#if MASK
	float mask = texSample2D(g_Texture2, v_TexCoord.xy).r;
#else
#define mask 1.0
#endif

	float alpha = mask * u_alpha * clampUV.x * clampUV.y;
#if CLIPCOLOR
	alpha *= chromaKey(albedo, clip);
#endif

	vec2 screenCoord = v_ScreenCoord.xy / v_ScreenCoord.z * CAST2(0.5) + 0.5;
	vec4 bg = texSample2D(g_Texture3, screenCoord.xy);
	albedo.rgb = mix(bg.rgb, albedo.rgb, albedo.a);
	
	albedo.a = BlendTransparency(albedo.a, clip.a, u_alpha); //Apply transparency blending mode
	albedo.rgb = ApplyBlending(BLENDMODE, albedo.rgb, clip.rgb, alpha * clip.a);
#endif //if there's a texture

	gl_FragColor = albedo;
}