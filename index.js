export default async (videoFile, mimeType) => {
	try {
		const audioContext = new (window.AudioContext || window.webkitAudioContext)()
		const arrayBuffer = await readArrayBuffer(videoFile)
		const audioData = await audioContext.decodeAudioData(arrayBuffer)
		const offlineAudioContext = new OfflineAudioContext(1, audioData.sampleRate * audioData.duration, audioData.sampleRate)
		const bufferSource = offlineAudioContext.createBufferSource()
		bufferSource.buffer = audioData
		bufferSource.connect(offlineAudioContext.destination)
		bufferSource.start()
		const waveFileData = createWaveFileData(await offlineAudioContext.startRendering())
		const blob = new Blob([waveFileData], { type: mimeType })
		return {
			name: videoFile.name.substring(0, videoFile.name.lastIndexOf('.')),
			format: mimeType.split('/').pop(),
			blob: blob,
			error: false
		}
	} catch {
		return { error: true }
	}
}

function readArrayBuffer(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => resolve(reader.result)
		reader.onerror = reject
		reader.readAsArrayBuffer(file)
	})
}

function createWaveFileData(audioBuffer) {
	const numChannels = audioBuffer.numberOfChannels
	const length = audioBuffer.length * numChannels
	const dataSize = length * 2
	const buffer = new ArrayBuffer(44 + dataSize)
	const view = new DataView(buffer)
	writeString('RIFF', view, 0)
	writeInt32(36 + dataSize, view, 4)
	writeString('WAVE', view, 8)
	writeString('fmt ', view, 12)
	writeInt32(16, view, 16)
	writeInt16(1, view, 20)
	writeInt16(numChannels, view, 22)
	writeInt32(audioBuffer.sampleRate, view, 24)
	writeInt32(audioBuffer.sampleRate * numChannels * 2, view, 28)
	writeInt16(numChannels * 2, view, 32)
	writeInt16(16, view, 34)
	writeString('data', view, 36)
	writeInt32(dataSize, view, 40)
	writeAudioBuffer(audioBuffer, view, 44)
	return new Uint8Array(buffer)
}

function writeString(string, view, offset) {
	for (let i = 0; i < string.length; i++) {
		view.setUint8(offset + i, string.charCodeAt(i))
	}
}

function writeInt16(value, view, offset) {
	view.setInt16(offset, value, true)
}

function writeInt32(value, view, offset) {
	view.setInt32(offset, value, true)
}

function writeAudioBuffer(audioBuffer, view, offset) {
	const numChannels = audioBuffer.numberOfChannels
	for (let i = 0; i < audioBuffer.length; i++) {
		for (let channel = 0; channel < numChannels; channel++) {
			const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]))
			const sampleValue = sample < 0 ? sample * 32768 : sample * 32767
			writeInt16(sampleValue, view, offset)
			offset += 2
		}
	}
}
