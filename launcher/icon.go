package main

import "encoding/binary"

func buildICO(r, g, b uint8) []byte {
	const w, h = 16, 16

	pixelData := make([]byte, w*h*4)
	for i := 0; i < w*h; i++ {
		pixelData[i*4+0] = b
		pixelData[i*4+1] = g
		pixelData[i*4+2] = r
		pixelData[i*4+3] = 255
	}
	andMask := make([]byte, 4*h)

	bih := make([]byte, 40)
	binary.LittleEndian.PutUint32(bih[0:], 40)
	binary.LittleEndian.PutUint32(bih[4:], w)
	binary.LittleEndian.PutUint32(bih[8:], h*2)
	binary.LittleEndian.PutUint16(bih[12:], 1)
	binary.LittleEndian.PutUint16(bih[14:], 32)

	imageData := append(bih, pixelData...)
	imageData = append(imageData, andMask...)

	header := []byte{0, 0, 1, 0, 1, 0}

	dirEntry := make([]byte, 16)
	dirEntry[0] = w
	dirEntry[1] = h
	binary.LittleEndian.PutUint16(dirEntry[4:], 1)
	binary.LittleEndian.PutUint16(dirEntry[6:], 32)
	binary.LittleEndian.PutUint32(dirEntry[8:], uint32(len(imageData)))
	binary.LittleEndian.PutUint32(dirEntry[12:], 22)

	result := append(header, dirEntry...)
	result = append(result, imageData...)
	return result
}

var iconGreen = buildICO(0, 128, 0)
var iconRed = buildICO(220, 38, 38)
