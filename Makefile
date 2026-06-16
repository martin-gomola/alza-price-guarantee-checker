.PHONY: test dist version

test:
	npm test

dist: test
	npm run build
	@ls -lh dist/*.zip

version:
	@test -n "$(VERSION)" || (echo "Usage: make version VERSION=1.0.3" && exit 1)
	node -e 'const v=process.argv[1]; const fs=require("fs"); for (const f of ["package.json","manifest.json"]) { const p=JSON.parse(fs.readFileSync(f,"utf8")); p.version=v; fs.writeFileSync(f, JSON.stringify(p,null,2)+"\n"); }' $(VERSION)
	@echo "Version set to $(VERSION) in package.json and manifest.json"
