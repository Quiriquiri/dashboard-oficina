# Dashboard Oficina — Trello (ao vivo)

Dashboard estático que se liga diretamente à API do Trello a partir do browser de quem o abre.
Não guarda nem expõe nenhum dado do Trello — cada pessoa que abre a página introduz a sua
própria API key + token (ficam guardados só no `localStorage` do respetivo browser).

## Publicar no GitHub Pages (sem usar a linha de comandos)

1. Em https://github.com/new, cria um repositório novo (pode ser público — ver nota de
   privacidade abaixo). Nome sugerido: `dashboard-oficina`.
2. Dentro do repositório, clica em **Add file → Upload files** e arrasta o `index.html` (e este
   `README.md`, opcional) que vieram junto com este ficheiro.
3. Faz **Commit changes**.
4. Vai a **Settings → Pages**. Em "Build and deployment", escolhe **Deploy from a branch**,
   branch `main`, pasta `/ (root)`. Grava.
5. Ao fim de 1-2 minutos, o GitHub mostra o link (algo como
   `https://<o-teu-utilizador>.github.io/dashboard-oficina/`). Esse é o link definitivo do
   dashboard.

## Atualizar o dashboard no futuro

Basta repetir o passo 2 (Upload files, substituindo o `index.html`) sempre que eu te enviar uma
versão nova do ficheiro.

## Nota de privacidade

No plano gratuito do GitHub, uma página do GitHub Pages é sempre publicamente acessível a quem
tiver o link, mesmo que o repositório seja privado. Isto não expõe dados do Trello — a página só
mostra alguma coisa a quem introduzir a própria key/token do Trello com acesso ao board "OFICINA".
Se quiseres mesmo assim restringir o acesso à página em si (não só aos dados), isso só é possível
com GitHub Pro/Team/Enterprise.

## Ficheiro fonte

`index.html` é a mesma versão "ao vivo" do dashboard (busca os dados diretamente da API do
Trello no browser). A configuração de listas/categorias está documentada no projeto "Dashboard
EQM" em `claude/trello-dashboard-config.md`.
