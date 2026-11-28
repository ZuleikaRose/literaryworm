// Renders Auth's built email templates (../confirmation.html, recovery.html, email_change.html) with
// Go's html/template and text/template, as Supabase Auth would, in every language the app has, with
// none set and with an unknown code, and fails on a parse or execution error, a field Auth doesn't
// give (<no value>), a leftover marker, or a missing link. Run from this folder:
//
//	cd supabase/templates/rendercheck && go run .
package main

import (
	"bytes"
	"fmt"
	htmlt "html/template"
	"os"
	"strings"
	textt "text/template"
)

var langs = []string{"en", "es", "fr", "de", "pt", "it", "nl", "ja", "zh", "ko", "hi", "ar", "pl", "ru", "tr", "sv", "uk", "tl", "bg", "ro", "el", "", "xx"}

func main() {
	failed := false
	fail := func(f string, a ...interface{}) { fmt.Printf(f+"\n", a...); failed = true }
	for _, name := range []string{"confirmation", "recovery", "email_change"} {
		src, err := os.ReadFile("../" + name + ".html")
		if err != nil {
			fail("%s: %v", name, err)
			continue
		}
		h, herr := htmlt.New(name).Parse(string(src))
		t, terr := textt.New(name).Parse(string(src))
		if herr != nil || terr != nil {
			fail("%s: parse: %v %v", name, herr, terr)
			continue
		}
		for _, l := range langs {
			d := map[string]interface{}{}
			if l != "" {
				d["ui_language"] = l
			}
			data := map[string]interface{}{
				"SiteURL": "https://www.literaryworm.com", "ConfirmationURL": "https://example.supabase.co/auth/v1/verify?token=abc",
				"Token": "123456", "TokenHash": "hash", "RedirectTo": "https://www.literaryworm.com/", "Email": "old@example.com",
				"NewEmail": "new@example.com", "SendingTo": "new@example.com", "Data": d,
			}
			want := l
			if l == "" || l == "xx" {
				want = "en"
			}
			for kind, run := range map[string]func(*bytes.Buffer) error{
				"html": func(b *bytes.Buffer) error { return h.Execute(b, data) },
				"text": func(b *bytes.Buffer) error { return t.Execute(b, data) },
			} {
				var b bytes.Buffer
				if err := run(&b); err != nil {
					fail("%s %s %q: %v", name, kind, l, err)
					continue
				}
				out := b.String()
				for _, bad := range []string{"<no value>", "{{", "[[", "ZgotmplZ"} {
					if strings.Contains(out, bad) {
						fail("%s %s %q: output contains %s", name, kind, l, bad)
					}
				}
				if !strings.Contains(out, "example.supabase.co/auth/v1/verify") {
					fail("%s %s %q: no confirmation link", name, kind, l)
				}
				if !strings.Contains(out, `lang="`+want+`"`) {
					fail("%s %s %q: not marked lang=%q", name, kind, l, want)
				}
			}
		}
	}
	if failed {
		os.Exit(1)
	}
	fmt.Printf("3 templates render in %d language cases with html/template and text/template\n", len(langs))
}
