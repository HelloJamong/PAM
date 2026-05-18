package main

import (
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"time"

	"github.com/getlantern/systray"
)

var (
	childCmd *exec.Cmd
	exeDir   string
	mStatus  *systray.MenuItem
	mRestart *systray.MenuItem
	mOpen    *systray.MenuItem
	mQuit    *systray.MenuItem
)

func main() {
	exe, err := os.Executable()
	if err != nil {
		os.Exit(1)
	}
	exeDir = filepath.Dir(exe)
	systray.Run(onReady, onExit)
}

func onReady() {
	systray.SetIcon(iconPAM)
	systray.SetTooltip("PAM - 실행 중 (포트 3000)")

	mStatus = systray.AddMenuItem("PAM - 실행 중", "")
	mStatus.Disable()
	systray.AddSeparator()
	mOpen = systray.AddMenuItem("열기", "브라우저로 열기")
	mRestart = systray.AddMenuItem("재시작", "서버 재시작")
	mRestart.Hide()
	systray.AddSeparator()
	mQuit = systray.AddMenuItem("종료", "PAM 종료")

	if isPortInUse() {
		openBrowser()
		go handleMenuClicks()
		return
	}

	go startNode()
	go handleMenuClicks()
}

func onExit() {
	killNode()
}

func handleMenuClicks() {
	for {
		select {
		case <-mOpen.ClickedCh:
			openBrowser()
		case <-mRestart.ClickedCh:
			restartNode()
		case <-mQuit.ClickedCh:
			systray.Quit()
		}
	}
}

func startNode() {
	nodePath := filepath.Join(exeDir, "runtime", "node.exe")
	entryPath := filepath.Join(exeDir, "server", "index.js")

	cmd := exec.Command(nodePath, entryPath)
	cmd.Dir = exeDir
	if err := cmd.Start(); err != nil {
		setError()
		return
	}
	childCmd = cmd

	if !waitForServer(10 * time.Second) {
		setError()
		return
	}
	openBrowser()

	go func() {
		cmd.Wait()
		if childCmd == cmd {
			setError()
		}
	}()
}

func waitForServer(timeout time.Duration) bool {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		resp, err := http.Get("http://127.0.0.1:3000/api/health")
		if err == nil {
			resp.Body.Close()
			return true
		}
		time.Sleep(500 * time.Millisecond)
	}
	return false
}

func killNode() {
	if childCmd != nil && childCmd.Process != nil {
		childCmd.Process.Kill()
		childCmd = nil
	}
}

func restartNode() {
	killNode()
	mRestart.Hide()
	systray.SetIcon(iconPAM)
	systray.SetTooltip("PAM - 실행 중 (포트 3000)")
	mStatus.SetTitle("PAM - 실행 중")
	go startNode()
}

func setError() {
	systray.SetIcon(iconRed)
	systray.SetTooltip("PAM - 오류 발생")
	mStatus.SetTitle("PAM - 오류 발생")
	mRestart.Show()
}

func isPortInUse() bool {
	resp, err := http.Get("http://127.0.0.1:3000/api/health")
	if err != nil {
		return false
	}
	resp.Body.Close()
	return true
}

func openBrowser() {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", "http://127.0.0.1:3000")
	case "darwin":
		cmd = exec.Command("open", "http://127.0.0.1:3000")
	default:
		cmd = exec.Command("xdg-open", "http://127.0.0.1:3000")
	}
	_ = cmd.Start()
}

