// [COMBO] {"material":"ui_editor_properties_alignment","combo":"ALIGNMENT","type":"options","default":0,"options":{"ui_browse_properties_alignment_cover":0,"ui_browse_properties_alignment_fill":1,"ui_browse_properties_alignment_center":2,"ui_browse_properties_alignment_stretch":3,"ui_browse_properties_alignment_free":4}}
// [COMBO] {"material":"ui_browse_properties_mouse_parallax","combo":"PARALLAX","type":"options","default":0}
// [COMBO] {"material":"ui_editor_properties_worldspace","combo":"WORLDSPACE","type":"options","default":0,"require":{"ALIGNMENT":4}}

#include "common.h"

uniform sampler2D g_Texture1; // {"combo":"TEX","label":"ui_editor_properties_texture","material":"texture"}
uniform float u_texOffset; // {"default":"0","group":"ui_editor_properties_texture","label":"ui_editor_properties_offset","material":"1texOffset","range":[-1,1]}
uniform vec2 u_texOffset2; // {"default":"0 0","group":"ui_editor_properties_texture","label":"ui_editor_properties_offset","linked":true,"material":"1texOffset","range":[-1,1]}
uniform vec2 u_texturePos; // {"default":"0 0","group":"ui_editor_properties_texture","label":"ui_editor_properties_origin","material":"1textureOffset"}
uniform vec2 u_textureScale; // {"default":"1 1","group":"ui_editor_properties_texture","label":"ui_editor_properties_scale","material":"2textureScale"}
uniform vec2 u_textureDepth; // {"default":"1 1","group":"ui_editor_properties_texture","label":"ui_editor_properties_parallax_depth","linked":true,"material":"4textureParallaxDepth","range":[-2,2]}
uniform float u_textureAngle; // {"material":"3textureAngle","label":"ui_editor_properties_angle","default":0,"range":[0,6.28],"direction":true,"conversion":"rad2deg","group":"ui_editor_properties_texture"}
uniform vec2 u_layerDepth; // {"default":"1 1","group":"ui_editor_properties_layer","label":"ui_editor_properties_parallax_depth","linked":true,"material":"layerParallaxDepth","range":[-2,2]}

uniform mat4 g_ModelMatrix; //Layer's transformation matrix
uniform mat4 g_ModelMatrixInverse;

uniform vec4 g_Texture0Resolution;
uniform vec4 g_Texture1Resolution;
uniform vec4 g_Texture3Resolution;
uniform vec2 g_ParallaxPosition;
uniform mat4 g_ModelViewProjectionMatrix;
uniform mat4 g_EffectModelViewProjectionMatrix;

attribute vec3 a_Position;
attribute vec3 a_TexCoord;

varying vec4 v_TexCoord;
varying vec3 v_ScreenCoord;

void main() {
	gl_Position = mul(vec4(a_Position, 1.0), g_ModelViewProjectionMatrix);

	v_TexCoord.xy = a_TexCoord.xy;

#if TEX //if there's a texture
	v_ScreenCoord = mul(vec4((a_Position), 1.0), g_EffectModelViewProjectionMatrix).xyw;
#if HLSL
	v_ScreenCoord.y = -v_ScreenCoord.y;
#endif

#if PARALLAX
	vec2 parallaxOffset = vec2(g_ParallaxPosition.x - 0.5, 0.5 - g_ParallaxPosition.y);
#else //not PARALLAX
	const vec2 parallaxOffset = CAST2(0.0);
#define parallax 0.0
#endif

#if ALIGNMENT != 3 || PARALLAX //PARALLAX or not ALIGNMENT Stretch
	float ratio0 = g_Texture0Resolution.x / g_Texture0Resolution.y;
	float ratio1 = g_Texture1Resolution.x / g_Texture1Resolution.y;
	float ratio01 = ratio0 / ratio1;
	float horizontal = step(ratio0, ratio1);
	vec4 ratio = mix(vec4(1.0, 1.0 / ratio0, 1.0, ratio1 / ratio0), vec4(ratio0, 1.0, ratio01, 1.0), ALIGNMENT == int(1) ? 1.0 - horizontal : horizontal);
	vec2 scale = g_Texture0Resolution.xy / g_Texture1Resolution.xy;
#endif

#if PARALLAX || ALIGNMENT == 4 //PARALLAX or ALIGNMENT Free
	vec2 layerOrigin = vec2(g_ModelMatrix[3].x, -g_ModelMatrix[3].y) / g_Texture0Resolution.xy;

#if PARALLAX || WORLDSPACE
		vec2 layerScale = vec2(length(g_ModelMatrix[0].xy), length(g_ModelMatrix[1].xy));
#endif

#if PARALLAX && (ALIGNMENT != 4 || !WORLDSPACE) //PARALLAX and not WORLDSPACE
		mat2 layerRotMat = mat2(g_ModelMatrixInverse[0].xy, g_ModelMatrixInverse[1].xy);
#endif

#if ALIGNMENT != 4 //PARALLAX and not ALIGNMENT Free
		vec2 layerParallaxOffset = layerOrigin / g_Texture1Resolution.xy;
		vec2 parallax = mul(layerRotMat, (parallaxOffset + layerParallaxOffset) * layerScale * ratio.xy * u_textureDepth / scale) / ratio.xy / layerScale;
#endif
#endif


#if ALIGNMENT == 0 //Cover
	v_TexCoord.zw = (v_TexCoord.xy - 0.5) * ratio.zw + 0.5;
	vec2 excessSize = (g_Texture1Resolution.xy * max(scale.x, scale.y) - g_Texture0Resolution.xy) * 0.5 / g_Texture0Resolution.xy;
	
	v_TexCoord.zw += (excessSize * u_texOffset * vec2(horizontal, 1.0 - horizontal) + parallax) * ratio.zw;
#endif

#if ALIGNMENT == 1 //Fit
	v_TexCoord.zw = (v_TexCoord.xy - 0.5) * ratio.zw + 0.5;
	vec2 excessSize = (g_Texture0Resolution.xy - g_Texture1Resolution.xy * min(scale.x, scale.y)) * 0.5 / g_Texture0Resolution.xy;

	v_TexCoord.zw += (excessSize * -u_texOffset * vec2(1.0 - horizontal, horizontal) + parallax) * ratio.zw;
#endif

#if ALIGNMENT == 2 //Center
	v_TexCoord.zw = (v_TexCoord.xy - 0.5) * scale + 0.5;
	vec2 excessSize = (g_Texture1Resolution.xy - g_Texture0Resolution.xy) * 0.5 / g_Texture0Resolution.xy;

	v_TexCoord.zw += (excessSize * vec2(-u_texOffset2.x, u_texOffset2.y) + parallax) * scale;
#endif

#if ALIGNMENT == 3 //Stretch
	v_TexCoord.zw = v_TexCoord.xy + parallax;
#endif

#if ALIGNMENT == 4 //Free
	vec2 textureOrigin = vec2(u_texturePos.x, -u_texturePos.y) / g_Texture0Resolution.xy;
	vec2 textureScale = ratio.xy * max(scale.x, scale.y);

#if WORLDSPACE
		mat2 layerRotMat = mat2(g_ModelMatrix[0].xy, g_ModelMatrix[1].xy);

#if PARALLAX
			vec2 texParallaxOffset = parallaxOffset * u_textureDepth;
			vec2 layerParallaxOffset = (texParallaxOffset + (textureOrigin - layerOrigin) * scale) * u_layerDepth;
			vec2 parallax = texParallaxOffset - layerParallaxOffset;
#endif

		vec2 pivot = (layerOrigin - textureOrigin) * scale / ratio.zw;
		v_TexCoord.zw = mul(layerRotMat, (v_TexCoord.xy - 0.5) * textureScale * layerScale) / layerScale + pivot;
		v_TexCoord.zw = (((rotateVec2(v_TexCoord.zw, -u_textureAngle) - pivot) / ratio.xy + pivot) * ratio.zw + parallax) / u_textureScale + 0.5;
#else //not WORLDSPACE

#if PARALLAX
			vec2 layerParallaxOffset = (vec2(0.5, -0.5) - layerOrigin - 0.5) * vec2(ratio01, 1.0) + 0.5;
			vec2 parallax = mul(layerRotMat, (parallaxOffset + layerParallaxOffset) / vec2(ratio01, 1.0) * layerScale * ratio.xy * u_textureDepth) * scale / layerScale;
#endif

		v_TexCoord.zw = (rotateVec2((v_TexCoord.xy - 0.5 - textureOrigin) * textureScale / u_textureScale, -u_textureAngle) * ratio.zw + parallax) / ratio.xy + 0.5;
#endif
#endif

#endif //if there's a texture
}