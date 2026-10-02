#include "common.h"

varying vec2 v_TexCoord;

uniform float g_Time;
uniform vec3 u_color; // {"material":"圆环颜色","default":"1 0 0","type":"color"}
uniform vec3 u_color2; // {"material":"圆环颜色2","default":"0 0 1","type":"color"}
uniform float u_gradientRotation; // {"material":"渐变旋转","default":0.0,"range":[0.0,360.0]}

uniform float u_aa; // {"material":"边缘模糊","default":0.01,"range":[0.005,0.05]}
uniform float u_ringSize; // {"material":"圆环大小","default":0.3,"range":[0.1,0.8]}
uniform float u_ringWidth; // {"material":"圆环宽度","default":0.03,"range":[0.01,0.2]}
uniform float u_gapSize; // {"material":"缺口大小","default":280.0,"range":[0.0,360.0]}
uniform float u_cornerRadius; // {"material":"圆角半径","default":1.0,"range":[0.5,5.0]}
uniform float u_opacity; // {"material":"圆环透明度","default":1.0,"range":[0.0,1.0]}

void main() {
    // 将坐标转换到中心
    vec2 uv = v_TexCoord - vec2(0.5, 0.5);
    
    // 计算距离中心的距离
    float distance = length(uv);
    
    // 计算角度（弧度）
    float angle = atan2(uv.y, uv.x);
    
    // 创建基础圆环 - 修复逻辑确保只在圆环区域内显示
    float innerRadius = u_ringSize - u_ringWidth;
    float outerRadius = u_ringSize + u_ringWidth;
    // float ring = step(innerRadius, distance) * (1.0 - step(outerRadius, distance));
    float ring = smoothstep(innerRadius, innerRadius + u_aa, distance) * (1.0 - smoothstep(outerRadius - u_aa, outerRadius, distance));
    
    // 缺口参数 - 反转逻辑：Gap Size越大，显示的圆环越多
    float displayAngle = u_gapSize * M_PI / 180.0; // 要显示的角度范围
    
    // 缺口起始角度（固定在顶部12点钟方向）
    float displayStart = -M_PI * 0.5; // 顶部12点钟方向作为起点
    float displayEnd = displayStart + displayAngle; // 逆时针扩展
    
    // 将角度标准化到 [-π, π] 范围
    float normalizedAngle = angle;
    float normalizedDisplayEnd = displayEnd;
    
    // 处理角度跨越边界的情况
    if (displayEnd > M_PI) {
        normalizedDisplayEnd = displayEnd - 2.0 * M_PI;
    }
    
    // 计算当前角度是否在显示范围内（反转逻辑）
    bool inDisplay = false;
    
    if (displayAngle >= 2.0 * M_PI) {
        // 如果显示角度大于等于360度，整个圆环都应该显示
        inDisplay = true;
    } else if (normalizedDisplayEnd > displayStart) {
        // 正常情况：显示区域不跨越-π/π边界
        inDisplay = (normalizedAngle >= displayStart && normalizedAngle <= normalizedDisplayEnd);
    } else {
        // 跨越-π/π边界的情况
        inDisplay = (normalizedAngle >= displayStart || normalizedAngle <= normalizedDisplayEnd);
    }
    
    // 创建显示遮罩（反转逻辑）
    float displayMask = 0.0;
    
    // 如果在显示范围内，显示圆环
    if (inDisplay) {
        displayMask = 1.0;
    }
    
    // 圆角半径（可调节）
    float cornerRadius = u_ringWidth * u_cornerRadius;
    
    // 只有当Gap Size小于360度时才应用圆角效果
    if (displayAngle < 2.0 * M_PI) {
        // 计算显示区域的两个边缘角度
        float leftEdge = normalizedDisplayEnd;   // 左边缘（显示结束点）
        float rightEdge = displayStart; // 右边缘（显示起始点）
        
        // 计算显示区域边缘的圆角中心点
        vec2 leftCornerCenter = vec2(cos(leftEdge), sin(leftEdge)) * u_ringSize;
        vec2 rightCornerCenter = vec2(cos(rightEdge), sin(rightEdge)) * u_ringSize;
        
        // 计算到两个圆角中心的距离
        float distToLeftCorner = length(uv - leftCornerCenter);
        float distToRightCorner = length(uv - rightCornerCenter);
        
        // 检查是否在圆角区域内，并且在圆环范围内
        bool inRingRange = (distance >= u_ringSize - u_ringWidth && distance <= u_ringSize + u_ringWidth);
        
        // 在左圆角区域内应用圆角效果
        if (!inDisplay && inRingRange && distToLeftCorner <= cornerRadius) {
            displayMask = 1 - smoothstep(cornerRadius - (u_aa * 0.5), cornerRadius, distToLeftCorner);
        }
        
        // 在右圆角区域内应用圆角效果
        if (!inDisplay && inRingRange && distToRightCorner <= cornerRadius) {
            displayMask = 1 - smoothstep(cornerRadius - (u_aa * 0.5), cornerRadius, distToRightCorner);
        }
    }
    
    // 应用显示遮罩
    ring *= displayMask;
    
    // 计算渐变色
    // 将渐变旋转角度转换为弧度
    float rotationRad = u_gradientRotation * M_PI / 180.0;
    
    // 旋转UV坐标
    float cosRot = cos(rotationRad);
    float sinRot = sin(rotationRad);
    vec2 rotatedUV = vec2(
        uv.x * cosRot - uv.y * sinRot,
        uv.x * sinRot + uv.y * cosRot
    );
    
    // 计算渐变因子（从左到右，范围-0.5到0.5，转换为0到1）
    float gradientFactor = (rotatedUV.x + 0.5);
    gradientFactor = clamp(gradientFactor, 0.0, 1.0);
    
    // 混合两个颜色
    vec3 gradientColor = mix(u_color, u_color2, gradientFactor);
    
    // 应用渐变色
    vec3 color = gradientColor * ring;
    
    // 使用ring和透明度控制作为alpha值，实现透明背景和可调节透明度
    float finalAlpha = ring * u_opacity;
    
    // 确保圆环之外的区域完全透明，不影响背景
    if (finalAlpha <= 0.0) {
        discard; // 丢弃完全透明的像素，确保不影响背景
    }
    
    gl_FragColor = vec4(color, finalAlpha);
}