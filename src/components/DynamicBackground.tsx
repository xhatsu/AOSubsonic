import { useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '../store/player.store';

// Shader Sources
const vertexShaderSource = `
    attribute vec2 a_position;
    attribute vec2 a_texCoord;
    
    // [rotation(rad), scale, offsetX, offsetY]
    uniform vec4 u_layerTransform; 
    
    varying vec2 v_texCoord;
    varying vec2 v_uv;
    
    void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
        
        float rotation = u_layerTransform.x;
        float scale = u_layerTransform.y;
        vec2 offset = u_layerTransform.zw;
        
        vec2 centered = (a_position * 0.5 + 0.5) - 0.5;
        centered.y = -centered.y; 
        
        centered -= offset;
        
        float s = sin(-rotation);
        float c = cos(-rotation);
        centered = vec2(centered.x * c - centered.y * s, centered.x * s + centered.y * c);
        
        centered /= scale;
        v_uv = centered + 0.5;
    }
`;

const fragmentShaderSource = `
    #ifdef GL_ES
    precision mediump float;
    #endif
    
    varying vec2 v_uv;
    uniform sampler2D u_artworkTexture;
    uniform float u_transitionProgress;
    
    void main() {
        if (v_uv.x < 0.0 || v_uv.x > 1.0 || v_uv.y < 0.0 || v_uv.y > 1.0) {
            discard;
        } else {
            vec4 color = texture2D(u_artworkTexture, v_uv);
            gl_FragColor = vec4(color.rgb, color.a * u_transitionProgress);
        }
    }
`;

const blurFragmentShaderSource = `
    #ifdef GL_ES
    precision highp float;
    #endif

    varying vec2 v_texCoord;
    uniform sampler2D u_image;
    uniform vec2 u_resolution;
    uniform vec2 u_direction;
    uniform float u_blurRadius;

    float interleavedGradientNoise(vec2 uv) {
        return fract(52.9829189 * fract(dot(uv, vec2(0.06711056, 0.00583715))));
    }

    void main() {
        vec2 texelSize = 1.0 / u_resolution;
        vec2 step = u_direction * texelSize * (u_blurRadius * 0.3);
        
        vec4 color = texture2D(u_image, v_texCoord);
        float totalWeight = 1.0;
        
        float sigma = 9.0;
        float k = 2.0 * sigma * sigma;
        
        float maxSteps = min(u_blurRadius * 2.0, 20.0);
        for (float i = 1.0; i <= 20.0; i++) {
            if (i > maxSteps) break;
            float w = exp(-(i * i) / k);
            vec2 offset = step * i;
            
            color += texture2D(u_image, v_texCoord + offset) * w;
            color += texture2D(u_image, v_texCoord - offset) * w;
            totalWeight += 2.0 * w;
        }

        vec3 finalColor = color.rgb / totalWeight;
        gl_FragColor = vec4(finalColor, 1.0);
    }
`;

const basicVertexShaderSource = `
    attribute vec2 a_position;
    attribute vec2 a_texCoord;
    varying vec2 v_texCoord;
    void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
    }
`;

const postFragmentShaderSource = `
    #ifdef GL_ES
    precision mediump float;
    #endif

    varying vec2 v_texCoord;
    uniform sampler2D u_image;
    uniform float u_brightness;
    uniform float u_saturate;
    uniform float u_contrast;
    uniform float u_hueRotate;
    uniform float u_opacity;

    vec3 rgb2hsl(vec3 c) {
        float maxC = max(c.r, max(c.g, c.b));
        float minC = min(c.r, min(c.g, c.b));
        float l = (maxC + minC) * 0.5;
        float d = maxC - minC;
        if (d < 0.0001) return vec3(0.0, 0.0, l);
        float s = d / (1.0 - abs(2.0 * l - 1.0));
        float h;
        if (maxC == c.r)      h = mod((c.g - c.b) / d, 6.0);
        else if (maxC == c.g) h = (c.b - c.r) / d + 2.0;
        else                  h = (c.r - c.g) / d + 4.0;
        h /= 6.0;
        return vec3(h, s, l);
    }

    float hue2rgb(float p, float q, float t) {
        if (t < 0.0) t += 1.0;
        if (t > 1.0) t -= 1.0;
        if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
        if (t < 0.5)     return q;
        if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
        return p;
    }

    vec3 hsl2rgb(vec3 hsl) {
        float h = hsl.x, s = hsl.y, l = hsl.z;
        if (s < 0.0001) return vec3(l);
        float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
        float p = 2.0 * l - q;
        return vec3(
            hue2rgb(p, q, h + 1.0/3.0),
            hue2rgb(p, q, h),
            hue2rgb(p, q, h - 1.0/3.0)
        );
    }

    float interleavedGradientNoise(vec2 uv) {
        return fract(52.9829189 * fract(dot(uv, vec2(0.06711056, 0.00583715))));
    }

    void main() {
        vec4 src = texture2D(u_image, v_texCoord);
        vec3 c = src.rgb;
        c *= u_brightness;
        float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(vec3(luma), c, u_saturate);
        c = (c - 0.5) * u_contrast + 0.5;
        if (abs(u_hueRotate) > 0.0001) {
            vec3 hsl = rgb2hsl(clamp(c, 0.0, 1.0));
            hsl.x = fract(hsl.x + u_hueRotate / 6.28318530718);
            c = hsl2rgb(hsl);
        }
        c = clamp(c, 0.0, 1.0);

        // Noise removed to prevent grainy flicker when upscaled via CSS
        // (The heavy blur downsample naturally mitigates banding anyway)

        gl_FragColor = vec4(c, src.a * u_opacity);
    }
`;

function createShader(gl: WebGLRenderingContext, type: number, source: string) {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function createProgram(gl: WebGLRenderingContext, vs: WebGLShader, fs: WebGLShader) {
    const program = gl.createProgram();
    if (!program) return null;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program link error:', gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }
    return program;
}

function createDefaultTexture(gl: WebGLRenderingContext) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([15, 15, 20, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return texture;
}

const ROTATION_POWER = 0.4;
const ROTATION_SPEEDS = [-0.10, 0.18, 0.32];
const INITIAL_ROTATIONS = [0.3, -2.1, 2.4];
const LAYER_SCALES = [1.5, 2.2, 3.2];
const PERIMETER_SPEEDS = [0.045, 0.006, 0.01];
const PERIMETER_DIRECTION = [-1, 1, 1];
const LAYER_BASE_POSITIONS = [0, 0, 0.75, -0.75, -0.75, 0.75];

const BEAT_ROT_BOOST = [0.28, -0.18, 0.02];
const BEAT_SPD_BOOST = [0.8, 0.2, 0.5];
const BEAT_SCALE_BOOST = [0.2, 0.34, 0.39];
const BEAT_SCALE_DECAY = 2;

const BLUR_DOWNSAMPLE = 2;
const BLUR_RADIUS = 7;
const TARGET_FPS = 40;
const FRAME_INTERVAL = 1000 / TARGET_FPS;

interface Props {
    imageUrl?: string | null;
    isVisible: boolean;
    opacity?: number;
}

export const DynamicBackground = ({ imageUrl, isVisible, opacity = 1.0 }: Props) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { isPlaying } = usePlayerStore();
    const [glContext, setGlContext] = useState<WebGLRenderingContext | null>(null);

    // References to keep track of state across renders without causing re-renders
    const stateRef = useRef({
        gl: null as WebGLRenderingContext | null,
        vaoExt: null as any,
        programs: {} as any,
        locations: {} as any,
        buffers: {} as any,
        textures: {
            current: null as WebGLTexture | null,
            previous: null as WebGLTexture | null,
            render: null as WebGLTexture | null,
            blur: null as WebGLTexture | null
        },
        framebuffers: {
            render: null as WebGLFramebuffer | null,
            blur: null as WebGLFramebuffer | null
        },
        dimensions: {
            canvas: { width: 0, height: 0 },
            blur: { width: 0, height: 0 }
        },
        anim: {
            id: null as number | null,
            lastDrawTime: 0,
            startTime: 0,
            transitionProgress: 1.0,
            layerParams: new Float32Array(4),
            layerPerimTime: [0, 0, 0],
            layerBeatScale: [0, 0, 0],
            layerBeatRot: [0, 0, 0],
            beatEnergyBaseline: 0
        },
        audio: {
            ctx: null as AudioContext | null,
            analyser: null as AnalyserNode | null,
            source: null as MediaElementAudioSourceNode | null,
            element: null as HTMLAudioElement | null,
            dataArray: null as Uint8Array | null,
            beatPulse: 0
        },
        postParams: { brightness: 0.75, saturate: 1.4, contrast: 1.05, hueRotate: 0.0, opacity: opacity },
        currentUrl: null as string | null
    });

    // Audio Processing Logic
    const processAudio = () => {
        const s = stateRef.current;
        // Removing AudioContext hook because it hijacks the audio output and causes "no audio"
        // Just simulate a smooth pulse or keep it static
        s.audio.beatPulse *= 0.9;
    };

    // Setup WebGL
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctxAttribs = { alpha: false, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: false };
        const gl = (canvas.getContext('webgl', ctxAttribs) || canvas.getContext('experimental-webgl', ctxAttribs)) as WebGLRenderingContext;
        if (!gl) return;

        setGlContext(gl);
        stateRef.current.gl = gl;
        stateRef.current.vaoExt = gl.getExtension('OES_vertex_array_object');
        stateRef.current.anim.startTime = performance.now() / 1000;

        const vs = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
        const basicVs = createShader(gl, gl.VERTEX_SHADER, basicVertexShaderSource);
        const mainFs = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
        const blurFs = createShader(gl, gl.FRAGMENT_SHADER, blurFragmentShaderSource);
        const postFs = createShader(gl, gl.FRAGMENT_SHADER, postFragmentShaderSource);

        if (!vs || !basicVs || !mainFs || !blurFs || !postFs) return;

        const glProgram = createProgram(gl, vs, mainFs);
        const blurProgram = createProgram(gl, basicVs, blurFs);
        const postProgram = createProgram(gl, basicVs, postFs);

        if (!glProgram || !blurProgram || !postProgram) return;

        stateRef.current.programs = { main: glProgram, blur: blurProgram, post: postProgram };

        // Setup Locations
        const locs: any = { main: {}, blur: {}, post: {} };

        locs.main.a_pos = gl.getAttribLocation(glProgram, 'a_position');
        locs.main.a_tex = gl.getAttribLocation(glProgram, 'a_texCoord');
        locs.main.u_tex = gl.getUniformLocation(glProgram, 'u_artworkTexture');
        locs.main.u_prog = gl.getUniformLocation(glProgram, 'u_transitionProgress');
        locs.main.u_transform = gl.getUniformLocation(glProgram, 'u_layerTransform');

        locs.blur.a_pos = gl.getAttribLocation(blurProgram, 'a_position');
        locs.blur.a_tex = gl.getAttribLocation(blurProgram, 'a_texCoord');
        locs.blur.u_image = gl.getUniformLocation(blurProgram, 'u_image');
        locs.blur.u_res = gl.getUniformLocation(blurProgram, 'u_resolution');
        locs.blur.u_dir = gl.getUniformLocation(blurProgram, 'u_direction');
        locs.blur.u_rad = gl.getUniformLocation(blurProgram, 'u_blurRadius');

        locs.post.a_pos = gl.getAttribLocation(postProgram, 'a_position');
        locs.post.a_tex = gl.getAttribLocation(postProgram, 'a_texCoord');
        locs.post.u_img = gl.getUniformLocation(postProgram, 'u_image');
        locs.post.u_bright = gl.getUniformLocation(postProgram, 'u_brightness');
        locs.post.u_sat = gl.getUniformLocation(postProgram, 'u_saturate');
        locs.post.u_cont = gl.getUniformLocation(postProgram, 'u_contrast');
        locs.post.u_hue = gl.getUniformLocation(postProgram, 'u_hueRotate');
        locs.post.u_opac = gl.getUniformLocation(postProgram, 'u_opacity');
        stateRef.current.locations = locs;

        // Buffers
        const posBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

        const texBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);

        stateRef.current.buffers = { pos: posBuffer, tex: texBuffer };

        // VAOs
        const vaoExt = stateRef.current.vaoExt;
        const vaos: any = { main: null, blur: null, post: null };
        if (vaoExt) {
            vaos.main = vaoExt.createVertexArrayOES();
            vaoExt.bindVertexArrayOES(vaos.main);
            gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
            gl.enableVertexAttribArray(locs.main.a_pos);
            gl.vertexAttribPointer(locs.main.a_pos, 2, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer);
            gl.enableVertexAttribArray(locs.main.a_tex);
            gl.vertexAttribPointer(locs.main.a_tex, 2, gl.FLOAT, false, 0, 0);

            vaos.blur = vaoExt.createVertexArrayOES();
            vaoExt.bindVertexArrayOES(vaos.blur);
            gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
            gl.enableVertexAttribArray(locs.blur.a_pos);
            gl.vertexAttribPointer(locs.blur.a_pos, 2, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer);
            gl.enableVertexAttribArray(locs.blur.a_tex);
            gl.vertexAttribPointer(locs.blur.a_tex, 2, gl.FLOAT, false, 0, 0);

            vaos.post = vaoExt.createVertexArrayOES();
            vaoExt.bindVertexArrayOES(vaos.post);
            gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
            gl.enableVertexAttribArray(locs.post.a_pos);
            gl.vertexAttribPointer(locs.post.a_pos, 2, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer);
            gl.enableVertexAttribArray(locs.post.a_tex);
            gl.vertexAttribPointer(locs.post.a_tex, 2, gl.FLOAT, false, 0, 0);

            vaoExt.bindVertexArrayOES(null);
        }
        stateRef.current.programs.vaos = vaos;

        // Framebuffers and Textures
        const renderTex = gl.createTexture();
        const blurTex = gl.createTexture();

        const confTex = (t: WebGLTexture | null) => {
            gl.bindTexture(gl.TEXTURE_2D, t);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        };
        confTex(renderTex);
        confTex(blurTex);

        const renderFb = gl.createFramebuffer();
        const blurFb = gl.createFramebuffer();

        gl.bindFramebuffer(gl.FRAMEBUFFER, renderFb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, renderTex, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, blurFb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, blurTex, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        stateRef.current.textures.current = createDefaultTexture(gl);
        stateRef.current.textures.previous = createDefaultTexture(gl);
        stateRef.current.textures.render = renderTex;
        stateRef.current.textures.blur = blurTex;
        stateRef.current.framebuffers.render = renderFb;
        stateRef.current.framebuffers.blur = blurFb;

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        // Initial Resize
        stateRef.current.dimensions.canvas = { width: 0, height: 0 };
        handleResize(gl);

        const resizeObserver = new ResizeObserver(() => handleResize(gl));
        resizeObserver.observe(canvas);

        return () => {
            resizeObserver.disconnect();
            if (stateRef.current.anim.id) cancelAnimationFrame(stateRef.current.anim.id);
            gl.deleteProgram(glProgram);
            gl.deleteProgram(blurProgram);
            gl.deleteProgram(postProgram);
            if (stateRef.current.audio.source) {
                try { stateRef.current.audio.source.disconnect(); } catch (e) { }
            }
        };
    }, []);

    const handleResize = (gl: WebGLRenderingContext) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Downsampling for extreme performance. 
        // 128x128 native stretched via CSS + heavy blur downsampling = massive FPS boost
        const w = 128;
        const h = 128;

        if (w === stateRef.current.dimensions.canvas.width && h === stateRef.current.dimensions.canvas.height) return;

        canvas.width = w;
        canvas.height = h;
        stateRef.current.dimensions.canvas = { width: w, height: h };
        stateRef.current.dimensions.blur = { width: Math.max(1, Math.floor(w / BLUR_DOWNSAMPLE)), height: Math.max(1, Math.floor(h / BLUR_DOWNSAMPLE)) };

        gl.bindTexture(gl.TEXTURE_2D, stateRef.current.textures.render);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.bindTexture(gl.TEXTURE_2D, stateRef.current.textures.blur);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, stateRef.current.dimensions.blur.width, stateRef.current.dimensions.blur.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    };

    // Image Loading
    useEffect(() => {
        if (!glContext || imageUrl === stateRef.current.currentUrl) return;
        stateRef.current.currentUrl = imageUrl || null;

        const gl = glContext;
        const s = stateRef.current;

        const applyNewTex = (tex: WebGLTexture) => {
            if (s.textures.previous && s.textures.previous !== s.textures.current) {
                gl.deleteTexture(s.textures.previous);
            }
            s.textures.previous = s.textures.current;
            s.textures.current = tex;
            s.anim.transitionProgress = 0.0;
            if (!s.anim.id && isVisible) s.anim.id = requestAnimationFrame(animate);
        };

        if (!imageUrl) {
            applyNewTex(createDefaultTexture(gl));
            return;
        }

        const createTexFromImg = (img: HTMLImageElement) => {
            const tex = gl.createTexture();
            if (!tex) return null;
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            return tex;
        };

        const loadImg = (url: string, crossOrigin: string | null, onSuccess: (img: HTMLImageElement) => void, onError: () => void) => {
            const img = new Image();
            if (crossOrigin) img.crossOrigin = crossOrigin;
            img.onload = () => onSuccess(img);
            img.onerror = onError;
            img.src = url;
        };

        loadImg(imageUrl, "anonymous", (img) => {
            try {
                const tex = createTexFromImg(img);
                if (tex) applyNewTex(tex);
                else applyNewTex(createDefaultTexture(gl));
            } catch (e) {
                applyNewTex(createDefaultTexture(gl));
            }
        }, () => {
            // Fallback to proxy if CORS fails
            const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(imageUrl)}`;
            loadImg(proxyUrl, "anonymous", (img2) => {
                try {
                    const tex = createTexFromImg(img2);
                    if (tex) applyNewTex(tex);
                    else applyNewTex(createDefaultTexture(gl));
                } catch (e) {
                    applyNewTex(createDefaultTexture(gl));
                }
            }, () => {
                applyNewTex(createDefaultTexture(gl));
            });
        });

    }, [imageUrl, glContext]);

    // Animation Loop
    function animate(timestamp: number) {
        const s = stateRef.current;
        if (!s.gl || !isVisible) {
            s.anim.id = null;
            return;
        }
        const gl = s.gl;
        const elapsed = timestamp - s.anim.lastDrawTime;

        if (elapsed < FRAME_INTERVAL) {
            s.anim.id = requestAnimationFrame(animate);
            return;
        }

        const elapsedSec = Math.min(elapsed / 1000.0, 0.1);
        s.anim.lastDrawTime = timestamp - (elapsed % FRAME_INTERVAL);
        const currentTime = s.anim.lastDrawTime / 1000 - s.anim.startTime;

        const isTransitioning = s.anim.transitionProgress < 1.0;
        if (isTransitioning) {
            s.anim.transitionProgress = Math.min(1.0, s.anim.transitionProgress + 0.03);
        }

        processAudio();
        const pulse = s.audio.beatPulse;

        const shouldRender = isTransitioning || isPlaying || pulse > 0.001;
        if (!shouldRender && s.anim.transitionProgress >= 1.0) {
            s.anim.id = null;
            return;
        }

        s.anim.beatEnergyBaseline += (pulse - s.anim.beatEnergyBaseline) * Math.min(1.0, 0.8 * elapsedSec);
        const relativePulse = Math.max(0, pulse - s.anim.beatEnergyBaseline);

        for (let i = 0; i < 3; i++) {
            s.anim.layerPerimTime[i] += elapsedSec * (1.0 + pulse * BEAT_SPD_BOOST[i]);
            const speed = relativePulse > s.anim.layerBeatScale[i] ? 12.0 : BEAT_SCALE_DECAY;
            s.anim.layerBeatScale[i] += (relativePulse - s.anim.layerBeatScale[i]) * Math.min(1.0, speed * elapsedSec);
            s.anim.layerBeatRot[i] += (relativePulse - s.anim.layerBeatRot[i]) * Math.min(1.0, speed * elapsedSec);
        }

        const locs = s.locations;
        const progs = s.programs;
        const vaos = progs.vaos;
        const dims = s.dimensions;

        gl.bindFramebuffer(gl.FRAMEBUFFER, s.framebuffers.render);
        gl.viewport(0, 0, dims.canvas.width, dims.canvas.height);
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // --- MAIN PASS ---
        gl.useProgram(progs.main);
        if (s.vaoExt && vaos.main) {
            s.vaoExt.bindVertexArrayOES(vaos.main);
        } else {
            gl.bindBuffer(gl.ARRAY_BUFFER, s.buffers.pos);
            gl.vertexAttribPointer(locs.main.a_pos, 2, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, s.buffers.tex);
            gl.vertexAttribPointer(locs.main.a_tex, 2, gl.FLOAT, false, 0, 0);
        }

        gl.activeTexture(gl.TEXTURE0);
        gl.uniform1i(locs.main.u_tex, 0);

        const drawLayers = (tex: WebGLTexture | null, progress: number) => {
            if (progress <= 0.001 || !tex) return;
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.uniform1f(locs.main.u_prog, progress);

            for (let i = 0; i < 3; i++) {
                const bs = s.anim.layerBeatScale[i];
                const smoothBS = bs * bs * (3.0 - 2.0 * bs);
                const br = s.anim.layerBeatRot[i];
                const smoothBR = br * br * (3.0 - 2.0 * br);

                const rot = INITIAL_ROTATIONS[i] + (ROTATION_SPEEDS[i] * currentTime * ROTATION_POWER) + smoothBR * BEAT_ROT_BOOST[i];
                const bx = LAYER_BASE_POSITIONS[i * 2];
                const by = LAYER_BASE_POSITIONS[i * 2 + 1];

                const offset = i * 0.33;
                const t = ((offset + PERIMETER_DIRECTION[i] * PERIMETER_SPEEDS[i] * s.anim.layerPerimTime[i]) % 1.0);
                const angle = t * 6.283185307;
                const px = Math.abs(bx) * Math.cos(angle);
                const py = Math.abs(by) * Math.sin(angle);

                s.anim.layerParams[0] = rot;
                s.anim.layerParams[1] = LAYER_SCALES[i] + smoothBS * BEAT_SCALE_BOOST[i];
                s.anim.layerParams[2] = px;
                s.anim.layerParams[3] = py;

                gl.uniform4fv(locs.main.u_transform, s.anim.layerParams);
                gl.drawArrays(gl.TRIANGLES, 0, 6);
            }
        };

        if (s.anim.transitionProgress < 1.0) drawLayers(s.textures.previous, 1.0 - s.anim.transitionProgress);
        drawLayers(s.textures.current, s.anim.transitionProgress);

        if (s.vaoExt) s.vaoExt.bindVertexArrayOES(null);

        // --- BLUR PASS (Horizontal) ---
        gl.useProgram(progs.blur);
        gl.uniform1f(locs.blur.u_rad, BLUR_RADIUS);
        if (s.vaoExt && vaos.blur) {
            s.vaoExt.bindVertexArrayOES(vaos.blur);
        } else {
            gl.bindBuffer(gl.ARRAY_BUFFER, s.buffers.pos);
            gl.vertexAttribPointer(locs.blur.a_pos, 2, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, s.buffers.tex);
            gl.vertexAttribPointer(locs.blur.a_tex, 2, gl.FLOAT, false, 0, 0);
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, s.framebuffers.blur);
        gl.viewport(0, 0, dims.blur.width, dims.blur.height);
        gl.uniform2f(locs.blur.u_dir, 1.0, 0.0);
        gl.uniform2f(locs.blur.u_res, dims.canvas.width, dims.canvas.height);
        gl.bindTexture(gl.TEXTURE_2D, s.textures.render);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // --- BLUR PASS (Vertical) ---
        gl.bindFramebuffer(gl.FRAMEBUFFER, s.framebuffers.render);
        gl.viewport(0, 0, dims.canvas.width, dims.canvas.height);
        gl.uniform2f(locs.blur.u_dir, 0.0, 1.0);
        gl.uniform2f(locs.blur.u_res, dims.blur.width, dims.blur.height);
        gl.bindTexture(gl.TEXTURE_2D, s.textures.blur);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        if (s.vaoExt) s.vaoExt.bindVertexArrayOES(null);

        // --- POST PASS ---
        gl.useProgram(progs.post);
        if (s.vaoExt && vaos.post) {
            s.vaoExt.bindVertexArrayOES(vaos.post);
        } else {
            gl.bindBuffer(gl.ARRAY_BUFFER, s.buffers.pos);
            gl.vertexAttribPointer(locs.post.a_pos, 2, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, s.buffers.tex);
            gl.vertexAttribPointer(locs.post.a_tex, 2, gl.FLOAT, false, 0, 0);
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, s.textures.render);
        gl.uniform1i(locs.post.u_img, 0);

        s.postParams.opacity = opacity;

        gl.uniform1f(locs.post.u_bright, s.postParams.brightness);
        gl.uniform1f(locs.post.u_sat, s.postParams.saturate);
        gl.uniform1f(locs.post.u_cont, s.postParams.contrast);
        gl.uniform1f(locs.post.u_hue, s.postParams.hueRotate);
        gl.uniform1f(locs.post.u_opac, s.postParams.opacity);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        if (s.vaoExt) s.vaoExt.bindVertexArrayOES(null);

        s.anim.id = requestAnimationFrame(animate);
    };

    useEffect(() => {
        if (isVisible && !stateRef.current.anim.id && glContext) {
            stateRef.current.anim.id = requestAnimationFrame(animate);
        }
    }, [isVisible, isPlaying, glContext]);

    useEffect(() => {
        stateRef.current.postParams.opacity = opacity;
    }, [opacity]);

    return (
        <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0" style={{ isolation: 'isolate' }}>
            <canvas
                ref={canvasRef}
                className="absolute w-full h-full object-cover transition-opacity duration-700"
                style={{ opacity: isVisible ? 1 : 0 }}
            />
            {/* Native CSS noise overlay to fix color banding on 8-bit monitors without WebGL upscaling flicker */}
            <div 
                className="absolute inset-0 w-full h-full z-10 transition-opacity duration-700 pointer-events-none"
                style={{ 
                    opacity: isVisible ? 0.04 : 0, 
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'repeat'
                }}
            />
        </div>
    );
};
