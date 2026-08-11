package health

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestCheckAcceptsOnlyPAMHealth(t *testing.T) {
	tests := []struct {
		name       string
		statusCode int
		body       string
		want       bool
	}{
		{name: "PAM", statusCode: http.StatusOK, body: `{"status":"ok","app":"PAM"}`, want: true},
		{name: "generic health", statusCode: http.StatusOK, body: `{"status":"ok"}`, want: false},
		{name: "unrelated JSON", statusCode: http.StatusOK, body: `{"status":"running"}`, want: false},
		{name: "server error", statusCode: http.StatusInternalServerError, body: `{"status":"ok"}`, want: false},
		{name: "invalid JSON", statusCode: http.StatusOK, body: `not-json`, want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(tt.statusCode)
				_, _ = w.Write([]byte(tt.body))
			}))
			defer server.Close()

			if got := check(server.Client(), server.URL); got != tt.want {
				t.Fatalf("check() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestWaitTimesOutForUnrelatedService(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"not-pam"}`))
	}))
	defer server.Close()

	if Wait(server.URL, 20*time.Millisecond) {
		t.Fatal("Wait() accepted an unrelated service")
	}
}
