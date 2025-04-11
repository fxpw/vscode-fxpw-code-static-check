build:
	docker compose build --no-cache
stop:
	docker compose down
down:
	docker compose down
run:
	docker compose up -d
up:
	docker compose up -d
start:
	docker compose up -d
rebuild: build up
	echo "rebuild"
gf: # update
	eval $$(ssh-agent -s) && ssh-add ~/gitKey && git fetch
gm: # update and get from git repo
	eval $$(ssh-agent -s) && ssh-add ~/gitKey && git merge
update: gf gm rebuild
	echo "rebuild"
vscode-build:
	vsce package
	vsce publish
