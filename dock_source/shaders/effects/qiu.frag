#include "common_fragment.h"

// [COMBO] {"material":"彩虹变色开关","combo":"RAINBOW","type":"options","default":1}
// [COMBO] {"material":"自定义颜色开关","combo":"CUSTOMCOLOR","type":"options","default":0}
// [COMBO] {"material":"透明背景","combo":"TRANSPARENT_BG","type":"options","default":1}
// [COMBO] {"material":"球体纯色开关","combo":"SPHERE_SOLID_COLOR","type":"options","default":0}

uniform sampler2D g_Texture0; // {"material":"framebuffer","label":"ui_editor_properties_framebuffer","hidden":true}
uniform vec4 g_Texture0Resolution;
uniform float g_Time;
varying vec2 v_TexCoord;

// 自定义属性
uniform float u_FlowSpeed; // {"material":"液体滚动速度","default":0.5,"range":[0.1,2.0]}
uniform float u_SphereSize; // {"material":"球体大小","default":2.0,"range":[0.5,5.0]}
uniform vec3 u_Color1; // {"material":"颜色1","type":"color","default":"1 0.2 0.8"}
uniform vec3 u_Color2; // {"material":"颜色2","type":"color","default":"0.2 0.8 1"}
uniform vec3 u_SphereColor; // {"material":"球体颜色","type":"color","default":"0.8 0.4 1"}
uniform float u_SphereColorAlpha; // {"material":"球体纯色透明度","default":1.0,"range":[0.0,1.0]}
uniform float u_SphereEffectAlpha; // {"material":"球效果透明度","default":1.0,"range":[0.0,1.0]}

const float PI = 3.14159265;

vec3 cmap1(float x) { 
    return pow(vec3(0.5, 0.5, 0.5) + vec3(0.5, 0.5, 0.5) * cos(PI * x + vec3(1.0, 2.0, 3.0)), vec3(2.5, 2.5, 2.5)); 
}

vec3 cmap2(float x)
{
    vec3 col = vec3(0.35, 1.0, 1.0) * (cos(3.141592 * x * vec3(1.0, 1.0, 1.0) + 0.75 * vec3(2.0, 1.0, 3.0)) * 0.5 + 0.5);
    col *= col * col;
    return col;
}

vec3 cmap3(float x)
{
    vec3 yellow = vec3(1.0, 0.9, 0.0);
    vec3 purple = vec3(0.75, 0.0, 1.0);
    
    vec3 col = mix(purple, yellow, cos(x / 1.25) * 0.5 + 0.5);
    col *= col * col;
    return col;
}

// 彩虹调色板函数
vec3 rainbow_palette(float t) {
    vec3 a = vec3(0.5, 0.5, 0.5);
    vec3 b = vec3(0.5, 0.5, 0.5);
    vec3 c = vec3(1.0, 1.0, 1.0);
    vec3 d = vec3(0.263, 0.416, 0.557);
    return a + b * cos(6.28318 * (c * t + d));
}

vec3 cmap(float x)
{
#if RAINBOW
    // 彩虹模式
    return rainbow_palette(x + g_Time * 0.1);
#elif CUSTOMCOLOR
    // 自定义双色模式
    float blend = sin(x * 3.14159 + g_Time * 0.5) * 0.5 + 0.5;
    return mix(u_Color1, u_Color2, blend);
#else
    // 原始颜色模式
    float t = mod(g_Time, 30.0);
    return
    (smoothstep(-1.0, 0.0, t) - smoothstep(9.0, 10.0, t)) * cmap1(x) + 
    (smoothstep(9.0, 10.0, t) - smoothstep(19.0, 20.0, t)) * cmap2(x) + 
    (smoothstep(19.0, 20.0, t) - smoothstep(29.0, 30.0, t)) * cmap3(x) +
    (smoothstep(29.0, 30.0, t) - smoothstep(39.0, 40.0, t)) * cmap1(x);
#endif
}

void main()
{
    vec2 fragCoord = v_TexCoord * g_Texture0Resolution.xy;
    vec2 uv = (2.0 * fragCoord - g_Texture0Resolution.xy) / g_Texture0Resolution.y;

    float focal = 2.0;
    vec3 ro = vec3(0.0, 0.0, 6.0);
    
    float time = g_Time * u_FlowSpeed;
    
    vec3 rd = normalize(vec3(uv, -focal));

    vec3 color = vec3(0.0, 0.0, 0.0);
    bool insideSphere = false;
    
#if !TRANSPARENT_BG
    // 非透明模式才添加背景纹理
    color += pow(texSample2D(g_Texture0, rd.xy).rgb, vec3(2.2, 2.2, 2.2));
#endif
    
    time = g_Time;
    {
        float t = dot(vec3(0.0, 0.0, 0.0) - ro, rd);
        vec3 p = t * rd + ro;
        float y2 = dot(p, p);
        float sphereRadius = u_SphereSize * u_SphereSize;
        float x2 = sphereRadius - y2;
        if(y2 <= sphereRadius)
        {
            insideSphere = true;
            float a = t - sqrt(x2);
            float b = t + sqrt(x2);
    
            color *= exp(-(b - a));
    
            t = a + texSample2D(g_Texture0, frac(fragCoord / 1024.0)).a * 0.01;
            
            for(int i = 0; i < 99 && t < b; i++)
            {
                vec3 p = t * rd + ro;

                float T = (t + time) / 5.0;
                float c = cos(T);
                float s = sin(T);
                p.xy = mul(mat2(c, -s, s, c), p.xy);

                for(float f = 0.0; f < 9.0; f++) 
                {
                    float a = exp(f) / exp2(f);
                    p += cos(p.yzx * a + time) / a;
                }
                float d = 1.0 / 100.0 + abs((ro - p - vec3(0.0, 1.0, 0.0)).y - 1.0) / 10.0;
                color += cmap(t) * 1e-3 / d;
                t += d * 0.25;
            }
        
            float R0 = 0.04;
            vec3 N = normalize(a * rd + ro);
            float cosTheta = dot(-rd, N);
            float fresnel = R0 + (1.0 - R0) * pow(1.0 - cosTheta, 5.0);
            
            color *= 1.0 - fresnel;
            
#if SPHERE_SOLID_COLOR
            // 球体纯色模式：根据透明度混合纯色和背景纹理
            vec3 backgroundReflection = pow(texSample2D(g_Texture0, reflect(rd, N).xy).rgb, vec3(2.2, 2.2, 2.2));
            vec3 solidColor = u_SphereColor;
            color += fresnel * mix(backgroundReflection, solidColor, u_SphereColorAlpha);
#else
            // 原始模式：映射背景纹理
            color += fresnel * pow(texSample2D(g_Texture0, reflect(rd, N).xy).rgb, vec3(2.2, 2.2, 2.2));
#endif
        }
    }
    
    color = vec3(1.0, 1.0, 1.0) - exp(-color);
    
#if !TRANSPARENT_BG
    // 非透明模式才应用暗角效果
    color *= 1.0 - dot(uv * 0.55, uv * 0.55) * 0.15;
#endif
    
    color = pow(color, vec3(1.0 / 2.2, 1.0 / 2.2, 1.0 / 2.2));
    color *= 255.0;
    
#if TRANSPARENT_BG
    // 透明背景模式：只有球体内部有颜色，外部完全透明
    color /= 255.0;
    color = clamp(color, vec3(0.0, 0.0, 0.0), vec3(1.0, 1.0, 1.0));
    
    // 应用球效果透明度，只有在球体内部才有不透明度
    float alpha = insideSphere ? u_SphereEffectAlpha : 0.0;
    gl_FragColor = vec4(color, alpha);
#else
    // 原始模式：保留背景纹理
    color += 5.0 * (texSample2D(g_Texture0, frac(fragCoord / 1024.0)).rgb - vec3(0.5, 0.5, 0.5));
    color /= 255.0;
    color = clamp(color, vec3(0.0, 0.0, 0.0), vec3(1.0, 1.0, 1.0));
    
    // 应用球效果透明度
    gl_FragColor = vec4(color, u_SphereEffectAlpha);
#endif
}