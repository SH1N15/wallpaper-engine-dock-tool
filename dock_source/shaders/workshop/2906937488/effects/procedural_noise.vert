// [COMBO] {"material":"Noise category","combo":"AA_CATEGORY","type":"options","default":0,"options":{"Color":0,"UV":1}}
// [COMBO] {"material":"Noise type","combo":"AB_TYPECOLOR","type":"options","default":0,"options":{"White":0,"Perlin":1,"Simplex":2,"Worley":3,"Worley mix":4,"Voronoi":5},"require":{"AA_CATEGORY":0}}
// [COMBO] {"material":"Noise type","combo":"AB_TYPEUV","type":"options","default":0,"options":{"White":0,"Worley":1,"Worley mix":2,"Voronoi":3,"Curl":4,"Flow":5},"require":{"AA_CATEGORY":1}}
// [COMBO] {"material":"Perspective","combo":"PERSPSWITCH","type":"options","default":0}
// [COMBO] {"material":"Perspective","combo":"AD_PERSPECTIVE","type":"options","default":1,"options":{"Noise":1,"Noise + mirrored":2,"Noise + opacity mask":3,"Noise + mirrored + opacity mask":4,"Noise + opacity mask (repeat)":5,"Noise + mirrored + opacity mask (repeat)":6},"require":{"PERSPSWITCH":1}}
// [COMBO] {"material":"Tileable","combo":"TILE","type":"options","default":0}
// [COMBO] {"material":"Step animation","combo":"STEPANIM","type":"options","default":0}

#include "common.h"
#include "common_perspective.h"

uniform mat4 g_ModelViewProjectionMatrix;
uniform float g_Time;
uniform float g_FrameTime;
uniform vec4 g_Texture0Resolution;

uniform vec2 u_offset; // {"default":"0.0 0.0","group":"Compute noise","linked":true,"material":"Offset","range":[-1,1]}
uniform vec2 u_scale; // {"default":"1.0 1.0","group":"Compute noise","linked":true,"material":"Scale","range":[0,3]}
uniform float u_speed; // {"material":"animationspeed","label":"ui_editor_properties_animation_speed","default":1,"range":[0,3],"group":"Animate"}
uniform float u_dir; // {"material":"scrollirection","label":"ui_editor_properties_scroll_direction","default":0,"direction":true,"conversion":"rad2deg","group":"Animate"}
uniform float u_dirSpeed; // {"default":"0","group":"Animate","label":"ui_editor_properties_scroll_speed","material":"scrollspeed","range":[0,2]}
uniform vec2 u_magnitude; // {"default":"1 1","group":"Compute noise","linked":true,"material":"Magnitude","range":[0,1]}
uniform float u_shiftAmount; // {"material":"Sample shift amount","default":1,"range":[0,1],"group":"Compute noise"}
uniform float u_seed; // {"default":"0","group":"Compute noise","material":"Seed","range":[-1,1]}
uniform float u_fps; // {"default":"0","group":"Compute noise","material":"FPS","range":[0,10]}
uniform vec2 g_Point0; // {"default":"0 0","group":"Perspective","label":"p0","material":"point0"}
uniform vec2 g_Point1; // {"default":"1 0","group":"Perspective","label":"p1","material":"point1"}
uniform vec2 g_Point2; // {"default":"1 1","group":"Perspective","label":"p2","material":"point2"}
uniform vec2 g_Point3; // {"default":"0 1","group":"Perspective","label":"p3","material":"point3"}

attribute vec3 a_Position;
attribute vec2 a_TexCoord;

varying vec4 v_TexCoord; //xy = coords, zw = ratio
varying vec3 v_PerspCoord;
varying vec4 v_Transforms; //xy = offset, zw = scale
varying float v_Animate;
varying vec4 v_Magnitude;

void main() {
	v_TexCoord.zw = vec2(1.0, g_Texture0Resolution.y / g_Texture0Resolution.x); //Aspect ratio

#if AB_TYPECOLOR < 1 && AA_CATEGORY == 0 || AB_TYPEUV == 0 && AA_CATEGORY == 1 //Is Value noise
	v_Transforms.zw = max(1e-6, u_scale * g_Texture0Resolution.xy / 3.0);
	#if STEPANIM
		v_Animate = floor(g_Time * u_fps) / max(1e-6, u_fps) * u_speed * 0.01;
	#else
		v_Animate = g_Time * u_speed * 0.01;
	#endif
	v_Magnitude.xy = u_magnitude * 0.05;
#else
	v_Transforms.zw = max(1e-6, u_scale * 10.0);
	#if TILE //Is tileable
		v_TexCoord.zw = CAST2(1.0);
		v_Transforms.zw = (v_Transforms.zw - mod(v_Transforms.zw, CAST2(2.0))); //Keep the scale at values where tileability is possible
	#else
		v_Transforms.zw *= v_TexCoord.zw;
	#endif

	v_Magnitude.xy = CAST2(1.0);
	#if (AB_TYPECOLOR == 3 || AB_TYPECOLOR == 4 || AB_TYPECOLOR == 5) && AA_CATEGORY == 0 || ((AB_TYPEUV == 1 || AB_TYPEUV == 2 || AB_TYPEUV == 3) && AA_CATEGORY == 1) //Is Worley or Voronoi
		#if STEPANIM
			v_Animate = floor(g_Time * u_fps) / max(1e-6, u_fps) * u_speed * 4.0;
		#else
			v_Animate = g_Time * u_speed * 4.0;
		#endif
		v_Magnitude.xy = u_magnitude * 0.5;
	#else //Is Perlin, Simplex, Curl or FLow
		#if STEPANIM
			v_Animate = floor(g_Time * u_fps) / max(1e-6, u_fps) * u_speed;
		#else
			v_Animate = g_Time * u_speed;
		#endif
		#if AA_CATEGORY == 1 && AB_TYPEUV == 4 //Is Curl
			v_Magnitude.xy = u_magnitude * 0.15;
		#endif
		#if AA_CATEGORY == 1 && AB_TYPEUV == 5 //Is Flow
			v_Magnitude.xy = u_magnitude * 0.4;
		#endif
	#endif
#endif
	
	v_Animate += u_seed;
	v_Transforms.xy = (u_offset + vec2(sin(-u_dir), cos(u_dir)) * g_Time * u_dirSpeed * 10.0) * v_TexCoord.zw * v_Transforms.zw; //Calculate offset and scroll

	v_Magnitude.zw = CAST2(1.0);
#if (AB_TYPEUV == 1 || AB_TYPEUV == 2 || AB_TYPEUV == 3) && AA_CATEGORY == 1 //is Worley or Voronoi UV
	v_Magnitude.zw = u_shiftAmount / v_Transforms.zw;
#endif

#if PERSPSWITCH //With perspective
	mat3 xform = inverse(squareToQuad(g_Point0, g_Point1, g_Point2, g_Point3)); //Compute perspective
	v_PerspCoord = mul(vec3(a_TexCoord, 1.0), xform) * vec3(v_Transforms.zw, 1.0);
#else
	v_PerspCoord = vec3(a_TexCoord * v_Transforms.zw, 1.0);
#endif

	gl_Position = mul(vec4(a_Position, 1.0), g_ModelViewProjectionMatrix);
	v_TexCoord.xy = a_TexCoord;
}