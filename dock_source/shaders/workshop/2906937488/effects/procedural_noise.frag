// [COMBO] {"material":"Noise category","combo":"AA_CATEGORY","type":"options","default":0,"options":{Color":0,"UV":1}}
// [COMBO] {"material":"Noise type","combo":"AB_TYPECOLOR","type":"options","default":0,"options":{"White":0,"Perlin":1,"Simplex":2,"Worley":3,"Worley mix":4,"Voronoi":5},"require":{"AA_CATEGORY":0}}
// [COMBO] {"material":"Noise type","combo":"AB_TYPEUV","type":"options","default":0,"options":{"White":0,"Worley":1,"Worley mix":2,"Voronoi":3,"Curl":4,"Flow":5},"require":{"AA_CATEGORY":1}}
// [COMBO] {"material":"ui_editor_properties_blend_mode","combo":"BLENDMODE","type":"imageblending","default":0}
// [COMBO] {"material":"Write alpha","combo":"WRITEALPHA","type":"options","default":0,"require":{"AA_CATEGORY":0}}
// [COMBO] {"material":"Perspective","combo":"PERSPSWITCH","type":"options","default":0}
// [COMBO] {"material":"Blend transparency","combo":"F_TRANSPARENCY","type":"options","default":0,"options":{"Normal":0,"Replace":1,"Remove":2,"Add":3,"Min":4,"Multiply":5,"Burn":6,"Max":7,"Screen":8,"Dodge":9,"Overlay":10,"Difference":11,"Exclusion":12,"Subtract":13,"Reflect":14,"Phoenix":15,"Average":16,"Negation":17}}
// [COMBO] {"material":"Perspective","combo":"AD_PERSPECTIVE","type":"options","default":1,"options":{Noise":1,"Noise + mirrored":2,"Noise + opacity mask":3,"Noise + mirrored + opacity mask":4,"Noise + opacity mask (repeat)":5,"Noise + mirrored + opacity mask (repeat)":6},"require":{"PERSPSWITCH":1}}
// [COMBO] {"material":"Tileable (No Simplex/Curl)","combo":"TILE","type":"options","default":0}
// [COMBO] {"material":"Color mode","combo":"AC_COLORMODE","type":"options","default":0,"options":{"High-low":0,"Gradient map":1,"RGB":2},"require":{"AA_CATEGORY":0}}
// [COMBO] {"material":"Layered","combo":"LAYERED","type":"options","default":0}

#include "common.h"
#include "common_blending.h"

uniform sampler2D g_Texture0; // {"material":"framebuffer","label":"ui_editor_properties_framebuffer","hidden":true}
uniform sampler2D g_Texture1; // {"label":"ui_editor_properties_opacity_mask","material":"mask","combo":"MASK","mode":"opacitymask","paintdefaultcolor":"0 0 0 1"}
uniform sampler2D g_Texture2; // {"default":"gradient/gradient_fire","label":"ui_editor_properties_gradient_map","require":{"AA_CATEGORY":0,"AC_COLORMODE":1}}
uniform sampler2D g_Texture3; // {"label":"2nd Layer","combo":"LAYER2","require":{"LAYERED":1}}

uniform float u_thresholdOffset; // {"default":"0","group":"Post-processing","material":"Thresholds offset","range":[-1,1]}
uniform vec2 u_threshold; // {"default":"0 1","group":"Post-processing","linked":true,"material":"Thresholds","range":[-1,2]}
uniform float u_alpha; // {"material":"Opacity","default":1,"range":[0,1]}
uniform float u_exponent; // {"material":"Exponent","default":1,"range":[0,5],"group":"Post-processing"}
uniform float u_fractals; // {"material":"Fractals","int":true,"default":1,"range":[1,5],"group":"Compute noise"}
uniform float u_fadeMultiplier; // {"material":"Depth fade","default":0.1,"range":[0,1],"group":"Perspective"}
uniform vec3 u_colorsMin; // {"default":"0 0 0","group":"Post-processing","linked":true,"material":"Colors min","range":[0,1]}
uniform vec3 u_colorsMax; // {"default":"1 1 1","group":"Post-processing","linked":true,"material":"Colors max","range":[0,1]}
uniform float u_colorSpeed; // {"material":"Color change","int":false,"default":0.5,"range":[0,1],"group":"Animate"}
uniform vec3 u_colorLow; // {"default":"0 0 0","group":"Post-processing","material":"Color low","type":"color"}
uniform vec3 u_colorHigh; // {"default":"1 1 1","group":"Post-processing","material":"Color high","type":"color"}
uniform vec3 u_colorBorders; // {"default":"0 0 0","group":"Borders","material":"Color","type":"color"}
uniform float u_gradient; // {"default":"1","group":"Post-processing","material":"Gradient","range":[0,1]}
uniform float u_fractalScale; // {"material":"Fractal scaling","default":2,"range":[1,4],"group":"Compute noise"}
uniform float u_fractalInfluence; // {"material":"Fractal influence","default":0.5,"range":[0,1],"group":"Compute noise"}
uniform float u_borders; // {"material":"Thickness","default":0,"range":[-1,1],"group":"Borders"}
uniform float u_roundBorder; // {"material":"Rounding","default":0,"range":[0,2],"group":"Borders"}
uniform float u_borderSmooth; // {"material":"Smoothing","default":0,"range":[0,2],"group":"Borders"}

varying vec4 v_TexCoord; //xy = coords, zw = ratio
varying vec3 v_PerspCoord;
varying vec4 v_Transforms; //xy = offset, zw = scale
varying float v_Animate;
varying vec4 v_Magnitude;

float BlendTransparency(float base, float blend, float opacity){
    float transparency = base; //normal transparency
#if F_TRANSPARENCY == 1
    transparency = blend; //replace transparency
#endif
#if F_TRANSPARENCY == 2
    transparency = 1.0; //remove transparency
#endif
#if F_TRANSPARENCY == 3
    transparency = saturate(base + blend); //add transparency
#endif
#if F_TRANSPARENCY == 4
    transparency = min(base, blend); //Minimum transparency
#endif
#if F_TRANSPARENCY == 5
    transparency = base * blend; //multiply transparency
#endif
#if F_TRANSPARENCY == 6
    transparency = (blend == 0.0) ? blend : max((1.0 - ((1.0 - base) / blend)), 0.0); //Burn transparency
#endif
#if F_TRANSPARENCY == 7
    transparency = max(base, blend); //Maximum transparency
#endif
#if F_TRANSPARENCY == 8
    transparency = 1.0 - (1.0 - base) * (1.0 - blend); //Screen transparency
#endif
#if F_TRANSPARENCY == 9
    transparency = (blend == 1.0) ? blend : min(base / (1.0 - blend), 1.0); //Dodge transparency
#endif
#if F_TRANSPARENCY == 10
    transparency = base < 0.5 ? (2.0 * base * blend) : (1.0 - 2.0 * (1.0 - base) * (1.0 - blend)); //Overlay transparency
#endif
#if F_TRANSPARENCY == 11
    transparency = saturate(base - blend); //Difference transparency
#endif
#if F_TRANSPARENCY == 12
    transparency = base + blend - 2.0 * base + blend; //Exclusion transparency
#endif
#if F_TRANSPARENCY == 13
    transparency = saturate(base + blend - 1.0); //subtract transparency
#endif
#if F_TRANSPARENCY == 14
    transparency = (blend == 1.0) ? blend : min(base * base / (1.0 - blend), 1.0); //Reflect transparency
#endif
#if F_TRANSPARENCY == 15
    transparency = min(base, blend) - max(base, blend) + 1.0; //Phoenix transparency
#endif
#if F_TRANSPARENCY == 16
    transparency = (base + blend) / 2.0; //Average transparency
#endif
#if F_TRANSPARENCY == 17
    transparency = 1.0 - abs(1.0 - base - blend); //Negation transparency
#endif
    return mix(base, transparency, opacity);
}

// *** Use this for integer stepped ranges, ie Value-Noise/Perlin noise functions.
/*#define HASHSCALE1 0.1031
#define HASHSCALE3 vec3(0.1031, 0.1030, 0.0973)
#define HASHSCALE4 vec4(0.1031, 0.1030, 0.0973, 0.1099)*/

// For smaller input rangers like audio tick, run time or 0-1 UVs use these...
/*#define HASHSCALE1 (443.8975)
#define HASHSCALE3 vec3(443.897, 441.423, 437.195)
#define HASHSCALE4 vec4(443.897, 441.423, 437.195, 444.129)*/

float hash11(float p){
	vec3 p3 = frac(CAST3(p) * 0.1031);
	p3 += dot(p3, p3.yzx + 19.19);
	return frac((p3.x + p3.y) * p3.z);
}

float hash12(vec2 p){
	vec3 p3 = frac(vec3(p.xyx) * 0.1031);
	p3 += dot(p3, p3.yzx + 19.19);
	return frac((p3.x + p3.y) * p3.z);
}

float hash13(vec3 p3){
	p3 = frac(p3 * 0.1031);
	p3 += dot(p3, p3.yzx + 19.19);
	return frac((p3.x + p3.y) * p3.z);
}

vec2 hash21(float p){
	vec3 p3 = frac(CAST3(p) * vec3(0.1031, 0.1030, 0.0973));
	p3 += dot(p3, p3.yzx + 19.19);
	return frac((p3.xx + p3.yz) * p3.zy);
}

vec2 hash22(vec2 p){
	vec3 p3 = frac(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
	p3 += dot(p3, p3.yzx + 19.19);
	return frac((p3.xx + p3.yz) * p3.zy);
}

//optimized for time as input p3.z
vec2 hash23(vec3 p3){
	p3 = frac(p3 * vec3(0.1031, 0.1030, 437.195));
	p3 += dot(p3, p3.yzx + 19.19);
	return frac((p3.xx + p3.yz) * p3.zy);
}

vec3 hash31(float p){
	vec3 p3 = frac(CAST3(p) * vec3(0.1031, 0.1030, 0.0973));
	p3 += dot(p3, p3.yzx + 19.19);
	return frac((p3.xxy + p3.yzz) * p3.zyx);
}

vec3 hash32(vec2 p){
	vec3 p3 = frac(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
	p3 += dot(p3, p3.yxz + 19.19);
	return frac((p3.xxy + p3.yzz) * p3.zyx);
}

//optimized for time as input p3.z
vec3 hash33(vec3 p3){
	p3 = frac(p3 * vec3(0.1031, 0.1030, 437.195));
	p3 += dot(p3, p3.yxz + 19.19);
	return frac((p3.xxy + p3.yxx) * p3.zyx);
}

vec4 hash41(float p){
	vec4 p4 = frac(CAST4(p) * vec4(0.1031, 0.1030, 0.0973, 0.1099));
	p4 += dot(p4, p4.wzxy + 19.19);
	return frac((p4.xxyz + p4.yzzw) * p4.zywx);
}

vec4 hash42(vec2 p){
	vec4 p4 = frac(vec4(p.xyxy) * vec4(0.1031, 0.1030, 0.0973, 0.1099));
	p4 += dot(p4, p4.wzxy + 19.19);
	return frac((p4.xxyz + p4.yzzw) * p4.zywx);
}

//optimized for time as input p.z
vec4 hash43(vec3 p){
	vec4 p4 = frac(vec4(p.xyzx) * vec4(0.1031, 0.1030, 437.195, 0.1099));
	p4 += dot(p4, p4.wzxy + 19.19);
	return frac((p4.xxyz + p4.yzzw) * p4.zywx);
}

//optimized for time as input p4.w
vec4 hash44(vec4 p4){
	p4 = frac(p4 * vec4(0.1031, 0.1030, 0.0973, 444.129));
	p4 += dot(p4, p4.wzxy + 19.19);
	return frac((p4.xxyz + p4.yzzw) * p4.zywx);
}

//Triangle wave sine. period: [0,1]
float TnSin(float angle) {
    angle += 0.25;
    return 4.0 * abs(angle - floor(angle + 0.5)) - 1.0;
}
vec2 TnSin(vec2 angle) {
    angle += 0.25;
    return 4.0 * abs(angle - floor(angle + 0.5)) - 1.0;
}
vec4 TnSin(vec4 angle) {
    angle += 0.25;
    return 4.0 * abs(angle - floor(angle + 0.5)) - 1.0;
}

vec2 rotate(vec2 vec, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return mul(vec, mat2(c, s, -s, c));
}

#if (AB_TYPECOLOR == 1 && AA_CATEGORY == 0) || ((AB_TYPEUV == 4 || AB_TYPEUV == 5) && AA_CATEGORY == 1)
float interpolate(vec4 v1357, vec4 v2468, vec3 t) {
    v1357 = mix(v1357, v2468, t.x);
    v2468.xy = mix(v1357.xz, v1357.yw, t.y);
    return mix(v2468.x, v2468.y, t.z);
}
const vec2 sub = vec2(1.0, 0.0);

vec4 perlin(vec3 uv, float seed, vec2 scale) {
    vec3 floorUV = floor(uv);
    vec3 ceilUV = ceil(uv);
    vec3 fractUV = uv - floorUV;
    vec3 faded = fractUV * fractUV * fractUV * (fractUV * (fractUV * 6.0 - 15.0) + 10.0); //Quintic interpolation

    vec4 tiled = vec4(floorUV.xy, ceilUV.xy);
#if TILE
    tiled = mod(tiled, vec4(scale, scale));
#endif

#if AC_COLORMODE == 2 || AA_CATEGORY == 1
#define cycles 4
#else
#define cycles 1
#endif

    float color[4], f;
    vec4 v1357, v2468;
    for (int i = 0; i < cycles; i++){
        f = float(i);
        v1357.x = dot(hash44(vec4(tiled.xy, vec2(floorUV.z, seed) + f)).xyz - 0.5, fractUV);
        v2468.x = dot(hash44(vec4(tiled.zy, vec2(floorUV.z, seed) + f)).xyz - 0.5, fractUV - sub.xyy);
        v1357.y = dot(hash44(vec4(tiled.xw, vec2(floorUV.z, seed) + f)).xyz - 0.5, fractUV - sub.yxy);
        v2468.y = dot(hash44(vec4(tiled.zw, vec2(floorUV.z, seed) + f)).xyz - 0.5, fractUV - sub.xxy);
        v1357.z = dot(hash44(vec4(tiled.xy, vec2(ceilUV.z, seed) + f)).xyz - 0.5, fractUV - sub.yyx);
        v2468.z = dot(hash44(vec4(tiled.zy, vec2(ceilUV.z, seed) + f)).xyz - 0.5, fractUV - sub.xyx);
        v1357.w = dot(hash44(vec4(tiled.xw, vec2(ceilUV.z, seed) + f)).xyz - 0.5, fractUV - sub.yxx);
        v2468.w = dot(hash44(vec4(tiled.zw, vec2(ceilUV.z, seed) + f)).xyz - 0.5, fractUV - sub.xxx);
        color[i] = interpolate(v1357, v2468, faded); //Trilinear interpolation
    }

#if AC_COLORMODE == 2 || AA_CATEGORY == 1
    return vec4(color[0], color[1], color[2], color[3]);
#else
    return CAST4(color[0]);
#endif
}
#endif

#if (AB_TYPECOLOR == 2 && AA_CATEGORY == 0) || ((AB_TYPEUV == 4 || AB_TYPEUV == 5) && AA_CATEGORY == 1)
const vec2 C = vec2(0.166666666667, 0.333333333333);

vec4 simplex(vec3 uv, float seed, vec2 scale) {
#if TILE
    uv.xy = mod(uv.xy, scale); //TODO: work on tileability
    vec3 s = floor(uv + dot(uv, C.yyy));
#else
    vec3 s = floor(uv + dot(uv, C.yyy));
#endif
    vec3 x = uv - s + dot(s, C.xxx);

	vec3 e = step(x.yzx, x);
	vec3 i1 = e * (1.0 - e.zxy);
	vec3 i2 = 1.0 - e.zxy * (1.0 - e);
		
	vec3 x1 = x - i1 + C.x;
	vec3 x2 = x - i2 + C.y;
	vec3 x3 = x - 1.0 + 0.5;
	
	vec4 w, d;
	w.x = dot(x, x);
	w.y = dot(x1, x1);
	w.z = dot(x2, x2);
	w.w = dot(x3, x3);
	w = max(0.6 - w, CAST4(0.0));
    w *= w;
    w *= w;
	
#if (AA_CATEGORY == 0 && AB_TYPECOLOR == 2 && AC_COLORMODE == 2) || (AA_CATEGORY == 1 && AB_TYPEUV == 4) //Is color RGB or UV
#define cycles 4
#else
#define cycles 1
#endif

#if TILE
    vec4 coord1 = mod(vec4(s, seed), scale.xyxy);
    vec4 coord2 = mod(vec4(s + i1, seed), scale.xyxy);
    vec4 coord3 = mod(vec4(s + i2, seed), scale.xyxy);
    vec4 coord4 = mod(vec4(s + 1.0, seed), scale.xyxy);
#else
    vec4 coord1 = vec4(s, seed);
    vec4 coord2 = vec4(s + i1, seed);
    vec4 coord3 = vec4(s + i2, seed);
    vec4 coord4 = vec4(s + 1.0, seed);
#endif

    float color[4], f;
    for (int i = 0; i < cycles; i++){
        f = float(i);
        d.x = dot(hash44(coord1 + f).xyz - 0.5, x);
        d.y = dot(hash44(coord2 + f).xyz - 0.5, x1);
        d.z = dot(hash44(coord3 + f).xyz - 0.5, x2);
        d.w = dot(hash44(coord4 + f).xyz - 0.5, x3);

        d *= w;
        color[i] = dot(d, CAST4(40));
    }

#if (AA_CATEGORY == 0 && AB_TYPECOLOR == 2 && AC_COLORMODE == 2) || (AA_CATEGORY == 1 && AB_TYPEUV == 4) //Is color RGB or UV
    return vec4(color[0], color[1], color[2], color[3]);
#else
    return CAST4(color[0]);
#endif
}
#endif

#if (AB_TYPECOLOR == 3 || AB_TYPECOLOR == 4) && AA_CATEGORY == 0 || ((AB_TYPEUV == 1 || AB_TYPEUV == 2) && AA_CATEGORY == 1)
vec4 worley(vec3 uv, vec2 magnitude, vec2 scale, vec2 ratio, float seed) {
	vec2 index_uv = floor(uv.xy); //Cell position
	vec2 fract_uv = frac(uv.xy); //Inside cell position
	
	float minimum_dist = 2.0, dist, clampedDist;
    vec2 neighbor, p, diff, pos;
    vec4 values = CAST4(0.0);
	
	for (int y = -1; y <= 1; y++) {
		for (int x = -1; x <= 1; x++) { //Check all adjacent cells
			neighbor = vec2(float(x), float(y)); //Current cell index, relative to center one
#if TILE
            pos = mod(index_uv + neighbor, scale); //Current cell position, periodic for tileability
#else
            pos = index_uv + neighbor; //Current cell Position
            pos *= ratio; //Adjust aspect ratio, to avoid line artifacts when a scroll is applied
#endif
            p = hash23(vec3(pos, seed)); //Pseudo-randomize current cell position
            p = sin(uv.z + M_PI_2 * p) * magnitude + 0.5; //Animate
            p = neighbor + p - fract_uv;

			dist = length(p); //Distance from the center cell
            
#if (AA_CATEGORY == 0 && AB_TYPECOLOR == 4) || (AA_CATEGORY == 1 && AB_TYPEUV == 2) //worley mix
            clampedDist = saturate(dist);
            values.w = (1.0 - clampedDist) + values.w * clampedDist; //Mix function with 1 less multiplication. Blend between 1 and the value of the other cells nearby according to the distance
    #if AA_CATEGORY == 0 && AC_COLORMODE == 2 //RGB color mode
            values.rgb = mix(abs(hash32(pos)), values.rgb, CAST3(clampedDist)); //Blend between a pseudo random color and the color of the other cells nearby according to the distance
    #elif AA_CATEGORY == 1
            values.rg = mix(p + values.w, values.rg, clampedDist);
    #else
            values.rgb = CAST3(1.0 - (1.0 - values.w * 1.1) * 1.2);
    #endif
#else
            minimum_dist = min(minimum_dist, dist); //Distance to the closest nearby cell
            values.w = minimum_dist;
    #if AA_CATEGORY == 0 && AC_COLORMODE == 2 //RGB color mode
            if (dist == minimum_dist) values.rgb = abs(hash32(pos)) * dist; //Update current pixel to the color of the cell it's contained in
    #elif AA_CATEGORY == 1
            clampedDist = saturate(dist);
            values.rg = mix(p + values.w + 0.25, values.rg, clampedDist); //Update current pixel to the value of the cell it's contained in
    #else
            values.rgb = CAST3(1.0 - (1.0 - values.w * 1.1) * 1.2);
    #endif
#endif
		}
	}
	return values - 0.5;
}
#endif

#if (AB_TYPECOLOR == 5 && AA_CATEGORY == 0) || (AB_TYPEUV == 3 && AA_CATEGORY == 1)
vec4 voronoi(vec3 uv, vec2 magnitude, vec2 scale, vec2 ratio, float seed, float colorSpeed, out float border) {
	vec2 index_uv = floor(uv.xy); //Cell position
	vec2 fract_uv = frac(uv.xy); //Inside cell position

	float dist;
    vec2 neighbor, minimum_dist = CAST2(1e8), p, pos, oA, oB, r;
    vec4 values;
    border = 1.0;
	
	for (int j = -1; j <= 1; j++)
    for (int i = -1; i <= 1; i++) { //Check all adjacent cells
        neighbor = vec2(float(i), float(j)); //Current cell index, relative to center one
        r = neighbor;
#if TILE
        pos = mod(index_uv + neighbor, scale); //Current cell position, periodic for tileability
#else
        pos = index_uv + neighbor; //Current cell position
        pos *= ratio; //Adjust aspect ratio, to avoid line artifacts when a scroll is applied
#endif
        p = hash23(vec3(pos, seed)); //Pseudo-randomize current cell position
        p = sin(uv.z + M_PI_2 * p) * magnitude + 0.5; //Animate

        neighbor = neighbor + p - fract_uv;
        dist = dot(neighbor, neighbor); //Squared distance from the center cell
        
        if (dist < minimum_dist.x) { //Update current pixel to the value of the cell it's contained in
            minimum_dist.x = dist;
            oA = neighbor;
            oB = r;
            values.xy = p;
            values.zw = pos;
        }
    }

    //find borders
    if (abs(u_borders) > 0.001){
        minimum_dist = CAST2(1e8);
        for (int j = -2; j <= 2; j++)
        for (int i = -2; i <= 2; i++) { //Check all adjacent cells
            if (j == int(oB.y) && i == int(oB.x)) continue; //skip if it's the same cell
            neighbor = oB + vec2(float(i), float(j)); //Current cell index, relative to center one
#if TILE
            pos = mod(index_uv + neighbor, scale); //Current cell position, periodic for tileability
#else
            pos = index_uv + neighbor; //Current cell position
            pos *= ratio; //Adjust aspect ratio, to avoid line artifacts when a scroll is applied
#endif
            p = hash23(vec3(pos, seed)); //Pseudo-randomize current cell position
            p = sin(uv.z + M_PI_2 * p) * magnitude + 0.5; //Animate

            neighbor = neighbor + p - fract_uv;

            if (abs(dot(p, values.xy)) > 1e-4){
                vec2 diff = normalize(oA - neighbor);
                vec2 mid = neighbor + oA;
                dist = abs(dot(normalize(oA - neighbor), neighbor + oA)); // distanza dal centro del bordo

                if (dist < minimum_dist.x) { //Update current pixel to the value of the cell it's contained in
                    minimum_dist.y = minimum_dist.x;
                    minimum_dist.x = dist;
                } else if (dist < minimum_dist.y) {
                    minimum_dist.y = dist;
                }
            }
            
        }
        
        border = mix(minimum_dist.x, minimum_dist.x * (minimum_dist.y + 0.5), u_roundBorder); //apply rounding to cell borders
        if (u_borders > 0.0) border = smoothstep(u_borders * 0.5 - u_borderSmooth, u_borders * 0.5 + u_borderSmooth, border); //apply border smoothing
        else border = 1.0 - smoothstep(-u_borders * 0.5 - u_borderSmooth, -u_borders * 0.5 + u_borderSmooth, border); //apply inverted smoothing (negative thickness)
    }

#if AA_CATEGORY == 0 //Is RGB
    #if AC_COLORMODE == 2
        values = abs(TnSin(hash42(values.zw) + vec4(values.xy, values.yx) * colorSpeed)) * border; //Assign colors to the single cells
    #else
        values = CAST4(abs(TnSin(hash12(values.zw) + dot(values.x, CAST2(0.5)) * colorSpeed))) * border; //Assign a greyscale value to the single cells
    #endif
#else
    values = vec4(abs(TnSin(hash22(values.zw) + dot(values.xy, CAST2(0.5)) * colorSpeed)), 1.0, 1.0) * border; //Assign a greyscale value to the single cells
#endif
	return (values - 0.5) * 1.5;
}
#endif

#if AB_TYPEUV == 4 && AA_CATEGORY == 1
vec2 curl(vec2 uv, float speed, vec2 scale){
    vec2 eps = vec2(0.0, scale.y), n = CAST2(0.0);
	float f = 0.5, s = 1.0, a, b;
    vec4 noise;

    for (int i = 0; i < int(u_fractals); i++){
        noise = simplex(vec3((uv + eps) * s, speed), s, scale); //Generate a fractal of Perlin noise
        a = noise.x - noise.y;
        b = noise.z - noise.w;

        n += f * vec2(a, -b); //Apply fractal and influence
		s *= u_fractalScale; //Increase scale for every consecutive fractal
        scale *= u_fractalScale; //Increase period for every consecutive fractal
        speed += speed; //Double speed for every consecutive fractal
		f *= u_fractalInfluence; //Decrease the influence for every consecutive fractal
    }
    return n;
}
#endif

#if AB_TYPEUV == 5 && AA_CATEGORY == 1
vec2 flow(vec2 uv, float speed, vec2 period){
	vec2 n = CAST2(0.0), dn;
	float a = 0.5, angle, multipliedSpeed;
    float signedMultiplier = 1.0;

	for (int i = 0; i < int(u_fractals); i++){
        multipliedSpeed = speed * signedMultiplier;
		dn = rotate(CAST2(perlin(vec3(uv, multipliedSpeed), signedMultiplier, period).xy), multipliedSpeed + float(i)); //Generate a fractal of Perlin noise and rotates the resulting vector

		n += a * dn; //Apply fractal and influence
		uv *= u_fractalScale; //Increase scale for every consecutive fractal
        period *= u_fractalScale; //Increase period for every consecutive fractal
		a *= u_fractalInfluence; //Decrease the influence for every consecutive fractal
        signedMultiplier *= -2.0; //Double rotation speed and invert direction for every consecutive fractal
	}
	return n;
}
#endif

void main() {
    vec4 albedo = texSample2D(g_Texture0, v_TexCoord.xy); //Sample the texture

#if MASK
    #if (AD_PERSPECTIVE == 3 || AD_PERSPECTIVE == 4) && PERSPSWITCH
        float mask = texSample2D(g_Texture1, v_PerspCoord.xy / v_Transforms.zw / abs(v_PerspCoord.z)).r; //Sample opacity mask with perspective (no repeat)
    #else
        #if (AD_PERSPECTIVE == 5 || AD_PERSPECTIVE == 6) && PERSPSWITCH
            float mask = texSample2D(g_Texture1, frac(v_PerspCoord.xy / v_Transforms.zw / abs(v_PerspCoord.z))).r; //Sample opacity mask with perspective (repeat)
        #else
            float mask = texSample2D(g_Texture1, v_TexCoord.xy).r; //Sample opacity mask without perspective
        #endif
    #endif
#else
#define mask 1.0 //Everything visible if there's no opacity mask
#endif
    
    if (mask > 0.001 && u_alpha > 0.001){
        float border = 1.0;
#if LAYERED && LAYER2
        vec4 layer2 = texSample2D(g_Texture3, v_TexCoord.xy); //Sample the 2nd layer noise texture
#else
        vec4 layer2 = CAST4(0.5); //Neutral value if there's no 2nd layer noise
#endif
        vec2 coord = v_PerspCoord.xy / abs(v_PerspCoord.z) + v_Transforms.xy; //Map coordinates to perspective

#if AB_TYPECOLOR == 0 && AA_CATEGORY == 0 && AC_COLORMODE != 2 //Is White
	    vec4 col = CAST4(hash23(vec3(round(coord), v_Animate)).x); //Generate White noise
        col += layer2 - 0.5; //Blend with the 2nd layer noise
#endif

#if AB_TYPECOLOR == 0 && AA_CATEGORY == 0 && AC_COLORMODE == 2 //Is White RGB
	    vec4 col = hash43(vec3(floor(coord), v_Animate)); //Generate different White noise for each channel
        col += layer2 - 0.5; //Blend with the 2nd layer noise
#endif

#if AB_TYPECOLOR == 1 && AA_CATEGORY == 0 //Is Perlin
        float f, influence = 0.5;
        vec2 period = v_Transforms.zw;
        vec4 value = CAST4(0.0);
        for (int i = 1; i <= int(u_fractals); i++){
            f = float(i);
            value += perlin(vec3(coord, v_Animate), f, period) * influence; //Generate and add a fractal of Perlin noise
            influence *= u_fractalInfluence; //Decrease the influence for every consecutive fractal
            coord *= u_fractalScale; //Increase the scale for every consecutive fractal
            period *= u_fractalScale; //Increase the period for every consecutive fractal (for tileability)
        }
        value += (layer2 - 0.5) * 0.5; //Blend with the 2nd layer noise
        vec4 col = max(CAST4(0.0), value / (1.0 - influence) * 2.0 + 0.5); //Remap result in [0,1] range
#endif

#if AB_TYPECOLOR == 2 && AA_CATEGORY == 0 //Is Simplex
        float f, influence = 0.5;
        vec2 period = v_Transforms.zw;
        vec4 value = CAST4(0.0);
        for (int i = 1; i <= int(u_fractals); i++){
            f = float(i);
            value += simplex(vec3(coord, v_Animate), f, period) * influence; //Generate and add a fractal of Simplex noise
            influence *= u_fractalInfluence; //Decrease the influence for every consecutive fractal
            coord *= u_fractalScale; //Increase the scale for every consecutive fractal
            period *= u_fractalScale; //Increase the period for every consecutive fractal (for tileability)
        }
        value += layer2 - 0.5; //Blend with the 2nd layer noise
        vec4 col = max(CAST4(0.0), value / (1.0 - influence) + 0.5); //Remap result in [0,1] range
#endif

#if (AB_TYPECOLOR == 3 || AB_TYPECOLOR == 4 || AB_TYPECOLOR == 5) && AA_CATEGORY == 0 //Is Worley or Voronoi
        float f, influence = 0.5, edge = 1.0;
        vec2 period = v_Transforms.zw;
        vec4 value = CAST4(0.0);
        for (int i = 1; i <= int(u_fractals); i++){
            f = float(i);
        #if AB_TYPECOLOR == 5 //Is Voronoi
            value += voronoi(vec3(coord, v_Animate), v_Magnitude, v_Transforms.zw, v_TexCoord.zw, f, u_colorSpeed, edge) * influence; //Generate and add a fractal of Voronoi noise
            border *= mix(1.0, edge, influence + influence);
        #else //Is Worley
            value += worley(vec3(coord, v_Animate), v_Magnitude, period, v_TexCoord.zw, f) /*+ (AB_TYPECOLOR == int(4) ? -0.125 : 0.125)*/ * influence; //Generate and add a fractal of Worley noise
        #endif
            influence *= u_fractalInfluence; //Decrease the influence for every consecutive fractal
            coord *= u_fractalScale; //Increase the scale for every consecutive fractal
            period *= u_fractalScale; //Increase the period for every consecutive fractal (for tileability)
        }
        value += layer2 - 0.5; //Blend with the 2nd layer noise
        vec4 col = max(CAST4(0.0), value / (1.0 - influence) + 0.5); //Remap result in [0,1] range
#endif

#if AB_TYPEUV == 0 && AA_CATEGORY == 1 //Is White UV
        vec2 noisedCoord = (hash23(vec3(floor(coord * 0.5), v_Animate)) - 0.5).xy * v_Magnitude.xy * mask;
        noisedCoord += layer2.xy - 0.5; //Blend with the 2nd layer noise
#endif

#if (AB_TYPEUV == 1 || AB_TYPEUV == 2 || AB_TYPEUV == 3) && AA_CATEGORY == 1 //Is Worley or Voronoi UV
        float f, influence = 0.5, edge = 1.0;
        vec2 period = v_Transforms.zw;
        vec2 value = CAST2(0.0);
        for (int i = 1; i <= int(u_fractals); i++){
            f = float(i);
        #if AB_TYPEUV == 3 //Is Voronoi
            value += voronoi(vec3(coord, v_Animate), v_Magnitude, period, v_TexCoord.zw, f, 0.0, edge).xy * influence; //Generate and add a fractal of Voronoi noise
            border *= mix(1.0, edge, influence + influence);
        #else //Is Worley
            value += worley(vec3(coord, v_Animate), v_Magnitude, period, v_TexCoord.zw, f).xy * influence; //Generate and add a fractal of Worley noise
        #endif
            influence *= u_fractalInfluence; //Decrease the influence for every consecutive fractal
            coord *= u_fractalScale; //Increase the scale for every consecutive fractal
            period *= u_fractalScale; //Increase the period for every consecutive fractal (for tileability)
        }
        value += layer2.xy - 0.5; //Blend with the 2nd layer noise
        vec2 noisedCoord = value * mask * 2.0; //Remap result in [0,1] range
#endif

#if AB_TYPEUV == 4 && AA_CATEGORY == 1 //Is Curl
        vec2 noisedCoord = curl(coord, v_Animate, v_Transforms.zw) * mask * v_Magnitude.xy * v_Transforms.zw; //Generate Curl noise
        noisedCoord += layer2.xy - 0.5; //Blend with the 2nd layer noise
#endif

#if AB_TYPEUV == 5 && AA_CATEGORY == 1 //Is Flow
        vec2 noisedCoord = flow(coord, v_Animate, v_Transforms.zw) * mask * v_Magnitude.xy * v_Transforms.zw; //Generate Flow noise
        noisedCoord += layer2.xy - 0.5; //Blend with the 2nd layer noise
#endif

        float fadeFactor = 1.0;
#if (AD_PERSPECTIVE == 1 || AD_PERSPECTIVE == 3 || AD_PERSPECTIVE == 5) && PERSPSWITCH
        fadeFactor = saturate(smoothstep(0.0, 1.0, v_PerspCoord.z) / max(1e-6, u_fadeMultiplier)); //Calculate fade amount for normal perspective
#endif
#if (AD_PERSPECTIVE == 2 || AD_PERSPECTIVE == 4 || AD_PERSPECTIVE == 6) && PERSPSWITCH
        fadeFactor = saturate(smoothstep(0.0, 1.0, abs(v_PerspCoord.z)) / max(1e-6, u_fadeMultiplier)); //Calculate fade amount for normal and mirrored perspective
#endif

#if AA_CATEGORY == 0 //Is a color type noise
    col = max(CAST4(0.0), (pow(col, CAST4(u_exponent)) - u_threshold.x) / (u_threshold.y - u_threshold.x)) + u_thresholdOffset; //Apply thresholds and exponent adjustments

    #if AC_COLORMODE == 1 //Gradient map color mode
        col.rgb = mix(u_colorBorders, texSample2D(g_Texture2, col.rr).rgb, border); //Sample the gradient map
    #else
        col = saturate((col - 0.5) / max(1e-6, u_gradient) + 0.5); //Calculate how smooth the transition between high and low colors values have to be
    #endif
    #if AC_COLORMODE == 0 //High-low color mode
        col.rgb = mix(u_colorBorders, mix(u_colorLow, u_colorHigh, col), border); //Blend between the two colors
    #endif
    #if AC_COLORMODE == 2 //RGB color mode
        col.rgb = mix(u_colorBorders, col * (u_colorsMax - u_colorsMin) + u_colorsMin, border); //Set the color amount for each channel
    #endif

    #if WRITEALPHA
        col.a = saturate(col.a);
        #if AC_COLORMODE != 1 //If not gradient map
            col.a = mix(0.0, 1.0, saturate((col.a - 0.5) / max(1e-6, u_gradient) + 0.5)); //Calculate how smooth the transition between high and low alpha values have to be
        #endif
    #else
        col.a = 1.0;
    #endif
        col.rgb = ApplyBlending(BLENDMODE, albedo.rgb, col.rgb, u_alpha * mask * col.a * fadeFactor); //Apply blending mode
#else //Is a UV type noise
    #if AB_TYPEUV != 0
        float magnitude = length(noisedCoord);
        float scaledMagnitude = mix(u_threshold.x, u_threshold.y, pow(magnitude, u_exponent)) + u_thresholdOffset; //Apply thresholds and exponent adjustments
        scaledMagnitude = ((scaledMagnitude - 0.5) * max(1e-6, u_gradient) + 0.5); //Calculate how smooth the transition between high and low colors values have to be
        noisedCoord = noisedCoord / max(1e-6, magnitude) * scaledMagnitude * v_Magnitude.zw;
    #if AB_TYPEUV == 4 || AB_TYPEUV == 5
        noisedCoord /= v_Transforms.zw;
    #endif
    #endif

        vec4 col = texSample2D(g_Texture0, v_TexCoord.xy + noisedCoord * fadeFactor * border); //Sample the texture using the noised coordinates
        col.rgb = ApplyBlending(BLENDMODE, albedo.rgb, col.rgb, u_alpha); //Apply blending mode
#endif
        col.a = BlendTransparency(albedo.a, col.a, u_alpha * mask); //Apply transparency blending mode

        gl_FragColor = col;
    } else gl_FragColor = albedo;
}