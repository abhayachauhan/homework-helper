.PHONY: build login up down logs update smoke

build:
	docker compose build

# Interactive one-time Claude login; writes OAuth creds to the claude-auth volume.
login:
	docker compose run --rm app claude login

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f --tail=100

# Pull latest, rebuild, restart.
update:
	git pull --ff-only
	docker compose build
	docker compose up -d

# Local sanity check that the app is serving (after `up`).
smoke:
	curl -fsS localhost:8080/api/profiles && echo "  <- profiles OK"
