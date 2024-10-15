package websocket

import "fmt"

type Message interface {
	Send() error
}

type TextMessage struct {
	content string
}

func (tm *TextMessage) Send() error {
	fmt.Println("Sending text message:", tm.content)
	return nil
}

type ImageMessage struct {
	imageURL string
}

func (im *ImageMessage) Send() error {
	fmt.Println("Sending image message:", im.imageURL)
	return nil
}