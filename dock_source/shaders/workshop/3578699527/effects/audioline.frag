// _.frag 文件内容 (复制并替换) - 【最终·防溢出版】

uniform sampler2D g_Texture0; // {"material":"framebuffer","label":"ui_editor_properties_framebuffer","hidden":true}

// ------------------- 用户可配置属性 -------------------
uniform vec3 u_curveColor;      // {"default":"1.0 1.0 1.0","material":"曲线颜色","type":"color"}
uniform float u_curveOpacity;   // {"material":"曲线透明度","default":1.0,"range":[0.0, 1.0]}
uniform float u_amplitude;      // {"material":"整体振幅","default":0.4,"range":[0.0, 2.0]}
uniform float u_maxFreqBand;    // {"material":"频率范围 (0-63)","default":48.0,"range":[1.0, 63.0]}
uniform float u_envelopeSteepness; // {"material":"包络线陡峭度","default":2.0,"range":[0.1, 8.0]}
uniform float u_curveThickness; // {"material":"曲线粗细","default":0.003,"range":[0.001, 0.05]}
uniform float u_smoothness;     // {"material":"曲线平滑度 (抗锯齿)","default":0.003,"range":[0.001, 0.05]}
uniform float u_verticalOffset; // {"material":"垂直位置 (基线)","default":0.0,"range":[-0.5, 0.5]}

// ------------------- Wallpaper Engine 内置变量 -------------------
uniform vec4 g_Texture0Resolution;
uniform float g_AudioSpectrum64Left[64];
uniform float g_AudioSpectrum64Right[64];
const int BANDS = 64;
varying vec2 v_TexCoord;

// ------------------- 辅助函数 -------------------

float getMirroredAudioValue(int index, int maxBand) {
    index = abs(index);
    if (index > maxBand) {
        index = maxBand - (index - maxBand);
    }
    index = clamp(index, 0, BANDS - 1);
	return (g_AudioSpectrum64Left[index] + g_AudioSpectrum64Right[index]) * 0.5;
}

float cubicSpline(float p0, float p1, float p2, float p3, float t) {
    float t2 = t * t;
    float t3 = t2 * t;
    return 0.5 * (
        (2.0 * p1) +
        (-p0 + p2) * t +
        (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t2 +
        (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t3
    );
}

// ------------------- 主函数 -------------------
void main() {
	// 1. 坐标系和频率映射
	vec2 uv = v_TexCoord - 0.5;
	uv.x *= g_Texture0Resolution.x / g_Texture0Resolution.y;
	float x_norm = abs(uv.x) / (0.5 * g_Texture0Resolution.x / g_Texture0Resolution.y);
    float freq_norm = 1.0 - x_norm;
	
    // 2. 获取平滑插值后的音频数据
	float audioIndexFloat = freq_norm * u_maxFreqBand;
	int index1 = int(floor(audioIndexFloat));
	float t = frac(audioIndexFloat);
    int maxBandInt = int(u_maxFreqBand);

	float p0 = getMirroredAudioValue(index1 - 1, maxBandInt);
	float p1 = getMirroredAudioValue(index1, maxBandInt);
	float p2 = getMirroredAudioValue(index1 + 1, maxBandInt);
	float p3 = getMirroredAudioValue(index1 + 2, maxBandInt);
    
	float rawAudioValue = cubicSpline(p0, p1, p2, p3, t);
    rawAudioValue = max(0.0, rawAudioValue);

	// 3. 对音频强度进行变换 (包络线逻辑)
    // *** 核心改动：使用 max(0.0, ...) 来防止 pow 的底数为负，从而避免 NaN 错误 ***
    float envelope = pow(max(0.0, 1.0 - x_norm), u_envelopeSteepness);
	float finalAudioValue = rawAudioValue * envelope * u_amplitude;

	// 4. 绘制曲线
	float curve_y = u_verticalOffset - finalAudioValue;
	float dist = abs(uv.y - curve_y);
	float halfThickness = u_curveThickness / 2.0;
	float lineIntensity = 1.0 - smoothstep(halfThickness, halfThickness + u_smoothness, dist);

	// 5. 最终颜色合成
	vec4 originalColor = texSample2D(g_Texture0, v_TexCoord.xy);
    float effectiveCurveAlpha = lineIntensity * u_curveOpacity;
	vec3 finalColor = mix(originalColor.rgb, u_curveColor, effectiveCurveAlpha);
    float finalAlpha = max(originalColor.a, effectiveCurveAlpha);
	gl_FragColor = vec4(finalColor, finalAlpha);
}