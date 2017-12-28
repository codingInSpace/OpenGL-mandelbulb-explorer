#version 400 core

in vec3 vertRayOrigin;
in vec3 vertRayDirection;

uniform float u_time;
uniform float u_screenRatio;
uniform vec2 u_screenSize;
uniform vec3 u_eyePos;

uniform float u_maxRaySteps;
uniform float u_minDistance;
uniform int u_mandelIters;
uniform float u_bailLimit;
uniform float u_fudgeFactor;

// mandelbulb
uniform float u_power;
uniform int u_derivativeBias;

// boxfolding
uniform int u_boxFoldFactor;
uniform float u_boxFoldingLimit;

// spherefolding
uniform int u_sphereFoldFactor;
uniform float u_sphereMinRadius;
uniform float u_sphereFixedRadius;
uniform bool u_sphereMinTimeVariance;

// tetra
uniform int u_tetraFactor;
uniform float u_tetraScale;

uniform float u_mandelRFactor;
uniform float u_mandelGFactor;
uniform float u_mandelBFactor;

uniform vec3 u_lightPos;
uniform vec3 u_bgColor;
uniform vec3 u_mandelColorA;
uniform vec3 u_mandelColorB;
uniform vec3 u_glowColor;
uniform float u_shadowDarkness;
uniform float u_glowFactor;
uniform bool u_showBgGradient;
uniform bool u_phongShading;
uniform float u_ambientIntensity;
uniform float u_diffuseIntensity;
uniform float u_specularIntensity;
uniform float u_shininess;
uniform float u_noiseFactor;
uniform bool u_gammaCorrection;

out vec4 outColor;

#define SPHERE_R 0.9
#define LOW_P_ZERO 0.00001

//
// Description : Array and textureless GLSL 2D/3D/4D simplex
//               noise functions.
//      Author : Ian McEwan, Ashima Arts.
//  Maintainer : stegu
//     Lastmod : 20110822 (ijm)
//     License : Copyright (C) 2011 Ashima Arts. All rights reserved.
//               Distributed under the MIT License. See LICENSE file.
//               https://github.com/ashima/webgl-noise
//               https://github.com/stegu/webgl-noise
//

vec3 mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 mod289(vec4 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute(vec4 x) {
     return mod289(((x*34.0)+1.0)*x);
}

vec4 taylorInvSqrt(vec4 r)
{
  return 1.79284291400159 - 0.85373472095314 * r;
}

float snoise(vec3 v)
  {
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

// First corner
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 =   v - i + dot(i, C.xxx) ;

// Other corners
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  //   x0 = x0 - 0.0 + 0.0 * C.xxx;
  //   x1 = x0 - i1  + 1.0 * C.xxx;
  //   x2 = x0 - i2  + 2.0 * C.xxx;
  //   x3 = x0 - 1.0 + 3.0 * C.xxx;
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy; // 2.0*C.x = 1/3 = C.y
  vec3 x3 = x0 - D.yyy;      // -1.0+3.0*C.x = -0.5 = -D.y

// Permutations
  i = mod289(i);
  vec4 p = permute( permute( permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

// Gradients: 7x7 points over a square, mapped onto an octahedron.
// The ring size 17*17 = 289 is close to a multiple of 49 (49*6 = 294)
  float n_ = 0.142857142857; // 1.0/7.0
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  //  mod(p,7*7)

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );

  //vec4 s0 = vec4(lessThan(b0,0.0))*2.0 - 1.0;
  //vec4 s1 = vec4(lessThan(b1,0.0))*2.0 - 1.0;
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

//Normalise gradients
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

// Mix final noise value
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                dot(p2,x2), dot(p3,x3) ) );
  }

float DESphere(vec3 p) {
    return length(p) - SPHERE_R;
}

void recTetra(inout vec3 z) {
	vec3 a1 = vec3(1,1,1);
	vec3 a2 = vec3(-1,-1,1);
	vec3 a3 = vec3(1,-1,-1);
	vec3 a4 = vec3(-1,1,-1);

    vec3 c = a1;
    float d = 0.0;
    float dist = length(z-a1);

    d = length(z-a2);
    if (d < dist) {
        c = a2;
        dist=d;
    }

    d = length(z-a3);
    if (d < dist) {
        c = a3;
        dist=d;
    }

    d = length(z-a4);
    if (d < dist) {
        c = a4;
        dist=d;
    }

    z = u_tetraScale*z-c*(u_tetraScale-1.0);
}

void sphereFold(inout vec3 z, inout float dz) {
	float r2 = dot(z,z);
	float minRadius = u_sphereMinRadius;

	if (float(u_sphereMinTimeVariance) > 0.5)
	    minRadius += 0.02 * abs(sin(u_time)) * abs(sin(0.1 * u_time));

	if (r2 < minRadius) {
		// linear inner scaling
		float temp = (u_sphereFixedRadius/minRadius);
		z *= temp;
		dz*= temp;
	} else if (r2 < u_sphereFixedRadius) {
		// this is the actual sphere inversion
		float temp = (u_sphereFixedRadius/r2);
		z *= temp;
		dz*= temp;
	}
}

void boxFold(inout vec3 z) {
	z = clamp(z, -u_boxFoldingLimit, u_boxFoldingLimit) * 2.0 - z;
}

float DEMandelbox(vec3 z) {
	vec3 offset = z;
	float dr = 1.0;
	int n;
	float scale = 0.01;

	for (n = 0; n < 13; n++) {
		boxFold(z);       // Reflect
		sphereFold(z, dr);    // Sphere Inversion

        z=scale*z + offset;  // Scale & Translate
        dr = dr*abs(scale)+1.0;
	}
	float r = length(z);
	return r / abs(dr);
}

void mandelbulb(inout vec3 z, inout float dr, in float r) {
    float theta = asin( z.z/r );
    float phi = atan( z.y,z.x );

    //dr = pow(r, u_power-1.0)*u_power*dr + 1.0;

    // With Mermelada's tweak to reduce errors
    // http://www.fractalforums.com/new-theories-and-research/error-estimation-of-distance-estimators/msg102670/?topicseen#msg102670
    dr = max(dr * float(u_derivativeBias), pow(r, u_power - 1.0) * u_power * dr + 1.0);

    // scale and rotate the point
    float zr = pow(r,u_power);
    theta = theta*u_power;
    phi = phi*u_power;

    // Alternate method to spherical
    z = zr*vec3( cos(theta)*cos(phi), cos(theta)*sin(phi), sin(theta) );
}

float DE(vec3 pos) {
	vec3 z = pos;
	float dr = 1.0;
	float r = 0.0;
	for (int i = 0; i < u_mandelIters; i++) {
		r = length(z);
		if (r > u_bailLimit) break;

        mandelbulb(z, dr, r);

        if (u_boxFoldFactor > 0) {
            boxFold(z);
            z *= float(u_boxFoldFactor);
        }

        if (u_sphereFoldFactor > 0) {
            sphereFold(z, dr);
            z *= float(u_sphereFoldFactor);
        }

        if (u_tetraFactor > 0) {
            recTetra(z);
            z *= float(u_tetraFactor);
        }

		z += pos;
	}

	return u_fudgeFactor * 0.5 * log(r) * r / dr;
}

// March with distance estimate and return grayscale value
float simpleMarch(vec3 from, vec3 dir, out int stepsTaken, out vec3 pos) {
	float totalDistance = 0.0;
	int steps;
	vec3 p;

	for (steps=0; steps < u_maxRaySteps; steps++) {
		p = from + totalDistance * dir;
		float distance = DE(p);
		totalDistance += distance;

		if (distance < u_minDistance && steps > 2) // First few steps are generally not hits, fixes shadow rays
            break;

        // Better performance but no bg color
		//if (distance < u_minDistance || distance > 20.0)
	}

	stepsTaken = steps;
	pos = p;
	return (1.0 - float(steps) / u_maxRaySteps); // greyscale val based on amount steps
}

// Simple numerical approximation of gradient
// calculated from the potential field formed by the DE
vec3 calculateNormal(vec3 p) {
    float e = 2e-6f;
    float n = DE(p);
    float dx = DE(p + vec3(e, 0, 0)) - n;
    float dy = DE(p + vec3(0, e, 0)) - n;
    float dz = DE(p + vec3(0, 0, e)) - n;
    vec3 grad = vec3(dx, dy, dz);
    return normalize(grad);
}

// https://www.shadertoy.com/view/XtjSDK
vec3 calcNormal(in vec3 pos) {
    vec3 eps = vec3(0.005,0.0,0.0);
	return normalize( vec3(
       DE(pos+eps.xyy) - DE(pos-eps.xyy),
       DE(pos+eps.yxy) - DE(pos-eps.yxy),
       DE(pos+eps.yyx) - DE(pos-eps.yyx)
    ));
}

vec3 calculateBlinnPhong(vec3 diffColor, vec3 p, vec3 rayDir) {
    vec3 ambientColor = diffColor * 0.8;
    const vec3 lightColor = vec3(1.0);
    const vec3 specColor = vec3(1.0);
    const float screenGamma   = 2.2;

    vec3 normal = calcNormal(p);

    vec3 eyeVec = u_eyePos - p;
    float distance = length(eyeVec);
    distance = distance * distance;
    eyeVec = normalize(eyeVec);
    vec3 lightVec = normalize(u_lightPos - p);
    vec3 H = normalize(lightVec + eyeVec);

    float lightPower = 0.4;

    float lambertian = max(dot(lightVec, normal), 0.0);
    float specular = max(dot(H, normal), 0.0);
    specular = pow(specular, u_shininess);

    vec3 BPColor = u_ambientIntensity * ambientColor +
        u_diffuseIntensity * diffColor * lambertian * lightColor * lightPower / distance +
        u_specularIntensity * specColor * specular * lightColor * lightPower / distance;

    // With gamma correction if we assume ambient-, diff-, specColor have been linearized
    return mix(BPColor, pow(BPColor, vec3(1.0/screenGamma)), float(u_gammaCorrection));
}

// Cast shadow ray towards light source
// If hit DE on the way, put area in shadow
vec3 castShadowRay(vec3 from, in vec3 color) {
    int stepsTaken = 0;
    vec3 pos;
    float gsValue = simpleMarch(from, normalize(u_lightPos - from), stepsTaken, pos);

    return mix(color, u_shadowDarkness * color, smoothstep(0.0, 1.0, gsValue));
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_screenSize.xy;

    int stepsTaken = 0;
    vec3 color;
    vec3 mandelPos;
    float gsValue = simpleMarch(vertRayOrigin, vertRayDirection, stepsTaken, mandelPos);

    // Ray miss completely; bg plane color
    if (gsValue < LOW_P_ZERO) {
        color = u_showBgGradient ? mix(u_bgColor, u_bgColor*0.8, uv.y) : u_bgColor;
        outColor = vec4(color, 1.0);
        return;
    }

    // Ray hit
    float noise = snoise(5.0 * mandelPos);
    noise += 0.5 * snoise(10.0 * mandelPos);
    noise += 0.25 * snoise(20.0 * mandelPos);
    noise = u_noiseFactor * noise;
    float timeVariance = 0.01 * abs(sin(0.6 * u_time));

    float r = stepsTaken*u_mandelRFactor/u_maxRaySteps;
    float g = stepsTaken*u_mandelGFactor/u_maxRaySteps;
    float b = stepsTaken*u_mandelBFactor/u_maxRaySteps;
    r = min(1.0, r + timeVariance);
    g = min(1.0, g);
    b = min(1.0, b);
    color = vec3(r, g, b) - 0.08 * u_noiseFactor * noise;
    color = mix(color, calculateBlinnPhong(color, mandelPos, vertRayDirection), float(u_phongShading));
    
    // Mix in glow
    color = mix(u_glowFactor * u_glowColor, color, smoothstep(0.0, 0.7, gsValue));

    // Soft shadow
    color = mix(color, castShadowRay(mandelPos, color), float(u_phongShading));

    // Dead pixels removal
    color = (clamp(color,0.,1.));

    // AO
    //color = mix(0.2 * color, color, gsValue);

    outColor = vec4(color, 1.0);
}
