//go:build windows

package main

import (
	"os/exec"
	"testing"
)

func TestConfigureBackgroundProcessDisablesConsoleWindow(t *testing.T) {
	cmd := exec.Command("node.exe")

	configureBackgroundProcess(cmd)

	if cmd.SysProcAttr == nil {
		t.Fatal("SysProcAttr is nil")
	}
	if !cmd.SysProcAttr.HideWindow {
		t.Fatal("HideWindow is false")
	}
	if cmd.SysProcAttr.CreationFlags&createNoWindow == 0 {
		t.Fatal("CREATE_NO_WINDOW is not set")
	}
}
