<script lang="ts">
	import { onMount } from 'svelte';

	let cv_cdn_url: string = 'https://cdn.jsdelivr.net/npm/opencv-browser@1.0.0/opencv.min.js';
	let img: HTMLImageElement;
	let imgURL: string = '/download.png';
	let video: HTMLVideoElement;
	let vidURL: string = '/SoccerShort.mp4';
	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D;
	let height: number;
	let width: number;

    let cap;

	// Function to wait for script loading
	function waitForScriptLoad(scriptSrc: string) {
		return new Promise<void>((resolve, reject) => {
			const existingScript = document.querySelector(`script[src="${scriptSrc}"]`);
			if (existingScript) {
				// Check if the script has already been loaded
				if (existingScript.getAttribute('data-loaded') === 'true') {
					resolve();
				} else {
					// Wait for the load event if not yet fully loaded
					existingScript.addEventListener('load', () => {
						existingScript.setAttribute('data-loaded', 'true');
						resolve();
					});
					existingScript.addEventListener('error', () => {
						reject(new Error(`Failed to load script: ${scriptSrc}`));
					});
				}
			} else {
				reject(new Error(`Script not found: ${scriptSrc}`));
			}
		});
	}

	async function loadVideo() {
		return new Promise((resolve) => {
			if (video.readyState >= 1) {
				resolve(1);
			} else {
				video.addEventListener('loadedmetadata', () => {
					resolve(1);
				});
			}
		});
	}

	// Function to wait for OpenCV to initialize
	function waitForOpenCVReady() {
		return new Promise<void>((resolve) => {
			cv['onRuntimeInitialized'] = () => {
				resolve();
			};
		});
	}

	onMount(async () => {
		video = document.querySelector('#videoInput');
		video.src = vidURL;

		try {
			await waitForScriptLoad(cv_cdn_url); // Wait for the script to load
			console.log('Script is loaded, waiting for OpenCV to initialize...');
		} catch (error) {
			console.error(error);
		}

		await loadVideo();
		cap = new cv.VideoCapture(video);
        console.log('cap = ', cap);

		height = video.videoHeight || 500;
		width = video.videoWidth || 500;

		let maxWidth = 500; //window.innerWidth
		let maxHeight = 500; //window.innerHeight

		console.log(width, height);
		if (height > maxHeight || width > maxWidth) {
			let ratio = Math.min(maxHeight / height, maxWidth / width);
			height *= ratio;
			width *= ratio;
		}

		img = document.querySelector('#imgInput');
		canvas = document.getElementById('canvasInput');
		ctx = canvas.getContext('2d', {willReadFrequenty: true});

		video.addEventListener('play', () => {
			tick();
		});


        let lastRender = 0;
        function tick(timestamp = 0) {
            if (timestamp - lastRender > 1000 / 30) { // Throttling to 30 FPS
                lastRender = timestamp;
                if (video.readyState === video.HAVE_ENOUGH_DATA) {
                    processFrame();
                }
            }
            if(!video.paused && !video.ended) {
                window.requestAnimationFrame(tick);
            }
        }

        function processFrame() {
            let frame = new cv.Mat(video.height, video.width, cv.CV_8UC4);
			cap.read(frame);
            if (frame.channels() !== 4) {
                console.error("Unexpected number of channels: ", frame.channels());
                cv.cvtColor(frame, frame, cv.COLOR_RGB2RGBA); // Convert to 4-channel if necessary
            }
			cv.imshow('canvasInput', frame);
            frame.delete();
        }

	});
</script>

<svelte:head>
	<script async src={cv_cdn_url} type="text/javascript"></script>
</svelte:head>

<h1>Welcome to SvelteKit</h1>
<p>Visit <a href="https://kit.svelte.dev">kit.svelte.dev</a> to read the documentation</p>

<button on:click={() => video.play()}>play</button>
<button on:click={() => video.pause()}>pause</button>

<img id="imgInput" src={imgURL} style="display: none" />
<video id="videoInput" controls  width=600 height=400 />

<canvas style="background-color: red;" id="canvasInput" width="640" height="480"> </canvas>
<canvas style="background-color: aqua;" id="canvasOutput" width="640" height="480"></canvas>
