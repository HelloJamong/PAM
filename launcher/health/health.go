package health

import (
	"encoding/json"
	"net/http"
	"time"
)

var client = &http.Client{Timeout: time.Second}

func check(httpClient *http.Client, baseURL string) bool {
	resp, err := httpClient.Get(baseURL + "/api/health")
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return false
	}

	var response struct {
		Status string `json:"status"`
		App    string `json:"app"`
	}
	return json.NewDecoder(resp.Body).Decode(&response) == nil &&
		response.Status == "ok" &&
		response.App == "PAM"
}

// Check reports whether baseURL serves the PAM health contract.
func Check(baseURL string) bool {
	return check(client, baseURL)
}

// Wait polls until the PAM health contract is available or timeout expires.
func Wait(baseURL string, timeout time.Duration) bool {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if Check(baseURL) {
			return true
		}
		delay := 500 * time.Millisecond
		if remaining := time.Until(deadline); remaining < delay {
			delay = remaining
		}
		if delay > 0 {
			time.Sleep(delay)
		}
	}
	return false
}
