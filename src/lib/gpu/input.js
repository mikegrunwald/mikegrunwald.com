// Single owner of pointer state for all GPU scenes.
// Pointer object shape intentionally mirrors WebGLFluid.js PointerPrototype.

export function correctDeltaX(delta, aspect) {
	return aspect < 1 ? delta * aspect : delta;
}

export function correctDeltaY(delta, aspect) {
	return aspect > 1 ? delta / aspect : delta;
}

function makePointer() {
	return {
		id: -1,
		texcoordX: 0,
		texcoordY: 0,
		prevTexcoordX: 0,
		prevTexcoordY: 0,
		deltaX: 0,
		deltaY: 0,
		down: false,
		moved: false,
		color: { r: 0, g: 0, b: 0 }
	};
}

function scaleByPixelRatio(input) {
	const pixelRatio = window.devicePixelRatio || 1;
	return Math.floor(input * pixelRatio);
}

export function createPointerInput({ getSize }) {
	const pointers = [makePointer()];
	const listeners = [];
	let mousemoveTimer = null;

	function updateDown(pointer, id, posX, posY) {
		const { width, height } = getSize();
		pointer.id = id;
		pointer.down = true;
		pointer.moved = false;
		pointer.texcoordX = posX / width;
		pointer.texcoordY = posY / height; // top-left uv convention (no flip)
		pointer.prevTexcoordX = pointer.texcoordX;
		pointer.prevTexcoordY = pointer.texcoordY;
		pointer.deltaX = 0;
		pointer.deltaY = 0;
	}

	function updateMove(pointer, posX, posY) {
		const { width, height } = getSize();
		const aspect = width / height;
		pointer.prevTexcoordX = pointer.texcoordX;
		pointer.prevTexcoordY = pointer.texcoordY;
		pointer.texcoordX = posX / width;
		pointer.texcoordY = posY / height;
		pointer.deltaX = correctDeltaX(pointer.texcoordX - pointer.prevTexcoordX, aspect);
		pointer.deltaY = correctDeltaY(pointer.texcoordY - pointer.prevTexcoordY, aspect);
		// TRIGGER === 'hover' semantics (the only trigger used in production)
		pointer.moved = Math.abs(pointer.deltaX) > 0 || Math.abs(pointer.deltaY) > 0;
	}

	function on(target, type, fn, opts) {
		target.addEventListener(type, fn, opts);
		listeners.push([target, type, fn]);
	}

	function start() {
		on(document, 'mousedown', (e) => {
			let pointer = pointers.find((p) => p.id === -1) ?? makePointer();
			updateDown(pointer, -1, scaleByPixelRatio(e.clientX), scaleByPixelRatio(e.clientY));
		});

		// Original delays mousemove attachment 500ms (WebGLFluid.js:1472-1478)
		mousemoveTimer = setTimeout(() => {
			on(document, 'mousemove', (e) => {
				updateMove(pointers[0], scaleByPixelRatio(e.clientX), scaleByPixelRatio(e.clientY));
			});
		}, 500);

		on(document, 'mouseup', () => {
			pointers[0].down = false;
		});

		on(document, 'touchstart', (e) => {
			const touches = e.targetTouches;
			while (touches.length >= pointers.length) pointers.push(makePointer());
			for (let i = 0; i < touches.length; i++) {
				updateDown(
					pointers[i + 1],
					touches[i].identifier,
					scaleByPixelRatio(touches[i].clientX),
					scaleByPixelRatio(touches[i].clientY)
				);
			}
		});

		on(document, 'touchmove', (e) => {
			const touches = e.targetTouches;
			for (let i = 0; i < touches.length; i++) {
				updateMove(
					pointers[i + 1],
					scaleByPixelRatio(touches[i].clientX),
					scaleByPixelRatio(touches[i].clientY)
				);
			}
		});

		on(document, 'touchend', (e) => {
			const touches = e.changedTouches;
			for (let i = 0; i < touches.length; i++) {
				const pointer = pointers.find((p) => p.id === touches[i].identifier);
				if (pointer) pointer.down = false;
			}
		});
	}

	function stop() {
		clearTimeout(mousemoveTimer);
		mousemoveTimer = null;
		for (const [target, type, fn] of listeners) target.removeEventListener(type, fn);
		listeners.length = 0;
	}

	return { pointers, start, stop };
}
