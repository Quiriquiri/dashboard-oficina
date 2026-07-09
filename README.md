# Dashboard Oficina — Trello (site multi-página)

Site estático com 6 páginas que se ligam diretamente à API do Trello a partir do browser de quem
o abre. Nenhum dado do Trello fica guardado no código — cada pessoa que abre o site introduz a
própria API key + token (ficam só no `localStorage` do respetivo browser, partilhados entre todas
as páginas do mesmo site).

Páginas: Visão Geral (`index.html`), A Decorrer Externo, A Decorrer Interno (Ligeiros / Pesados /
Máquinas, com sub-secção de "pendente de planeamento" para os Ligeiros), Pedreiras, Metalomecânica,
Planeamento Interno. Os gráficos da Visão Geral têm barras clicáveis que levam diretamente à
secção correspondente na página de detalhe.

## Publicar no GitHub Pages (sem usar a linha de comandos)

1. Em https://github.com/new, cria um repositório novo (pode ser público — ver nota de
   privacidade abaixo). Nome sugerido: `dashboard-oficina`.
2. Dentro do repositório, clica em **Add file → Upload files** e arrasta TODOS os ficheiros deste
   pacote (`index.html`, `decorrer-externo.html`, `decorrer-interno.html`, `pedreiras.html`,
   `metalomecanica.html`, `planeamento-interno.html`, `dashboard.js`, `styles.css`) — têm de ficar
   todos na raiz do repositório, uns ao lado dos outros.
3. Faz **Commit changes**.
4. Vai a **Settings → Pages**. Em "Build and deployment", escolhe **Deploy from a branch**,
   branch `main`, pasta `/ (root)`. Grava.
5. Ao fim de 1-2 minutos, o GitHub mostra o link (algo como
   `https://<o-teu-utilizador>.github.io/dashboard-oficina/`). Esse é o link definitivo — abre
   sempre em `index.html` (a Visão Geral) e navega para as outras páginas pelo menu do topo.

## Atualizar o site no futuro

Basta repetir o passo 2 (Upload files, substituindo os ficheiros que mudarem) sempre que eu te
enviar uma versão nova.

## Editar o Prazo diretamente no dashboard

A coluna "Prazo" de todas as tabelas é editável: clica na data para escolher outra, ou no "×" para
limpar. A alteração é gravada de imediato no cartão do Trello (pedido `PUT` à API). Para isto
funcionar, o token guardado no painel "Configurar chave/token" precisa de permissão de **escrita**
— o link para gerar esse token (com `scope=read,write`) está explicado dentro do próprio painel.
Um token só de leitura continua a mostrar os dados normalmente, só as alterações ao Prazo é que
falham (aparece "Falha ao gravar" junto à data).

## Editar etiquetas diretamente no dashboard

Na coluna "Etiquetas" de todas as tabelas há um botão "+" junto às etiquetas já aplicadas. Ao
clicar, abre um menu com todas as etiquetas existentes no board (caixa de checkboxes) — marcar ou
desmarcar grava de imediato no Trello (o conjunto completo de etiquetas do cartão é substituído
pelo que estiver marcado). O menu tem scroll interno quando há muitas etiquetas no board, para não
ultrapassar o ecrã. Tal como o Prazo, isto precisa do token com permissão de **escrita**.

## Coluna "Dias por planear"

Os cartões que ainda não têm data de início (fila de planeamento — Ligeiros em
"Planeamento Interno Ligeiros" e todos os cartões de "Planeamento Interno") mostram a coluna
"Criado em" (data de criação do cartão) e "Dias por planear" (quantos dias já passaram desde essa
criação). Serve para perceber há quanto tempo um trabalho está à espera de ser planeado, já que
ainda não tem uma data de início real associada.

## Nota de privacidade

No plano gratuito do GitHub, uma página do GitHub Pages é sempre publicamente acessível a quem
tiver o link, mesmo que o repositório seja privado. Isto não expõe dados do Trello — a página só
mostra alguma coisa a quem introduzir a própria key/token do Trello com acesso ao board "OFICINA".
Se quiseres mesmo assim restringir o acesso à página em si (não só aos dados), isso só é possível
com GitHub Pro/Team/Enterprise.

Nota adicional agora que há edição: um token com permissão de escrita permite alterar qualquer
board a que a tua conta Trello tenha acesso, não só este — não é possível restringir o token a
"só este board" ou "só ao Prazo" pela via simples de key+token. Trata o token como uma password
(não o partilhes, não o mostres em capturas de ecrã) e podes revogá-lo a qualquer momento em
trello.com/app-key.

## Manutenção — listas identificadas por nome

Ao contrário da versão anterior (de um único ficheiro), as listas do Trello são identificadas
pelo **nome exato** da lista (não por ID), configurado no topo de `dashboard.js`. Se renomeares
uma lista no Trello, ou criares uma nova equivalente, basta dizeres-me o novo nome exato para eu
atualizar essa constante — não é preciso ir buscar IDs à API.

A configuração completa (mapeamento de listas, metodologia dos tempos de resolução, etc.) está
documentada no projeto "Dashboard EQM" em `claude/trello-dashboard-config.md`.
