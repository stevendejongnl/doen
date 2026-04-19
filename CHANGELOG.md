## [1.1.1](https://github.com/stevendejongnl/doen/compare/v1.1.0...v1.1.1) (2026-04-19)


### Bug Fixes

* spread sharedStyles correctly into Lit static styles + version from git tag ([c99dc18](https://github.com/stevendejongnl/doen/commit/c99dc184a53f1bf04adfa110b576eaa7c42b7ef6))

# [1.1.0](https://github.com/stevendejongnl/doen/compare/v1.0.2...v1.1.0) (2026-04-19)


### Bug Fixes

* prevent iOS auto-zoom on input focus ([c602cad](https://github.com/stevendejongnl/doen/commit/c602cad3cb72b20e911b8de351664d563993da5a))


### Features

* show app version in sidebar footer and login page ([4a24faf](https://github.com/stevendejongnl/doen/commit/4a24faf60869c29c57047e88d7cdcfe37d80bcd2))

## [1.0.2](https://github.com/stevendejongnl/doen/compare/v1.0.1...v1.0.2) (2026-04-19)


### Bug Fixes

* load Font Awesome 7 via npm package bundled by Vite ([859bb0c](https://github.com/stevendejongnl/doen/commit/859bb0c837addf8f9c2ebd9c56f004266b604542))
* regenerate package-lock.json with Node 24 (matches CI lts/*) ([cadef07](https://github.com/stevendejongnl/doen/commit/cadef074d11e00e741db7b6f5fefd549b9a9431f))

## [1.0.1](https://github.com/stevendejongnl/doen/compare/v1.0.0...v1.0.1) (2026-04-19)


### Bug Fixes

* inject CSS tokens and Font Awesome 7 into every Lit shadow root ([a69f231](https://github.com/stevendejongnl/doen/commit/a69f2318ef5f6d32a9a9446cdf9edcf75e9d0810))

# 1.0.0 (2026-04-19)


### Bug Fixes

* CI green — ruff, lock files, mypy excludes test files ([386d99b](https://github.com/stevendejongnl/doen/commit/386d99bc9ad9ed007e26580b5d5a4d94eeecee76))
* use relative API URL in production ([e5bb880](https://github.com/stevendejongnl/doen/commit/e5bb880b40f2834bcaf83e9ab9b1678125b97bb1))


### Features

* mobile-first UI overhaul — glassmorphism, Font Awesome 7, responsive ([00377b8](https://github.com/stevendejongnl/doen/commit/00377b809d04d0b0fabfd0f3b00364321b6ce268))
* Phase 1 — FastAPI backend with full layered architecture ([d4bf139](https://github.com/stevendejongnl/doen/commit/d4bf139d25e792ab716e2e2e492b8e5baf3c8b08))
* Phase 2 — Lit PWA frontend with glassmorphism design ([82e29ac](https://github.com/stevendejongnl/doen/commit/82e29accf395760bb5053e514810b4fe2b8a4ef3))
* Phase 3 — APScheduler recurring task spawner ([a7b8265](https://github.com/stevendejongnl/doen/commit/a7b82653e33f5cfbc129cb3dd1273340695e3bfd))
* Phase 4 — HA integration, HACS card, sensors, OAuth, webhook ([218a11d](https://github.com/stevendejongnl/doen/commit/218a11da4ebee3d27cd57a60988483daced59d93))
* semantic-release + versioned Docker tags + nginx no-cache for index.html ([f5e1733](https://github.com/stevendejongnl/doen/commit/f5e1733f764f27d95c310eee80495bb1f234ceb1))
* serve frontend SPA via FastAPI StaticFiles ([406f591](https://github.com/stevendejongnl/doen/commit/406f5910d3244fda54102a82da3c561766af5afe))
