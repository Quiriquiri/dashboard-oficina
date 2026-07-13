# Dashboard Oficina — Trello (site multi-página)

Site estático com 6 páginas que se ligam diretamente à API do Trello a partir do browser de quem
o abre. Nenhum dado do Trello fica guardado no código — cada pessoa que abre o site introduz a
própria API key + token (ficam só no `localStorage` do respetivo browser, partilhados entre todas
as páginas do mesmo site).

Páginas: Visão Geral (`index.html`), A Decorrer Externo, A Decorrer Interno (Ligeiros / Pesados /
Máquinas, com sub-secção de "pendente de planeamento" para os Ligeiros), Pedreiras, Metalomecânica,
Planeamento Interno, Falta de Peças. Os gráficos da Visão Geral têm barras clicáveis que levam
diretamente à secção correspondente na página de detalhe.

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
Um token só de leitura continua a mostrar os dados normalmente, só as alterações falham (aparece
"Falha ao gravar" junto ao campo).

Junto ao Prazo há também um pequeno botão redondo ("○"/"✓") — é o **"Concluir"**: marca o cartão
como tendo o prazo cumprido (`dueComplete` no Trello, o campo que efetivamente fecha o cartão).
Clicar de novo desmarca (reabre).

## Editar a data de Início diretamente no dashboard

Nas tabelas que mostram a coluna "Início" (Metalomecânica e a secção "A decorrer" de cada oficina
em A Decorrer Interno), a data funciona tal como o Prazo: clica para escolher outra, ou no "×" para
limpar. Ao gravar, a coluna "Dias a decorrer" da mesma linha recalcula-se logo, sem precisar de
recarregar a página.

## Editar etiquetas diretamente no dashboard

Na coluna "Etiquetas" de todas as tabelas há um botão "+" junto às etiquetas já aplicadas. Ao
clicar, abre um menu com todas as etiquetas existentes no board (caixa de checkboxes) — marcar ou
desmarcar grava de imediato no Trello (o conjunto completo de etiquetas do cartão é substituído
pelo que estiver marcado). O menu tem scroll interno quando há muitas etiquetas no board, para não
ultrapassar o ecrã. Tal como o Prazo, isto precisa do token com permissão de **escrita**. Se um
cartão mudar de etiqueta numa página agrupada por etiqueta (Planeamento Interno), ele muda logo de
grupo para refletir a alteração.

## Editar o cartão (nome, descrição, lista, checklist, arquivar)

Junto ao nome de cada cartão há um botão "✎" que abre uma janela com:

- **Nome** e **Descrição** — texto livre, tal como no Trello.
- **Lista (mover cartão)** — um menu com todas as listas do board; escolher uma diferente move o
  cartão de imediato (por exemplo, passar de "Planeamento Interno" para "[Simão] Oficina Ligeiros"
  quando o trabalho arranca — o cartão desaparece dessa página e passa a aparecer na secção "a
  decorrer" correspondente).
- **Início** — mesma data do ponto anterior, disponível aqui também para os cartões que ainda não
  mostram essa coluna (fila de planeamento).
- **Checklist** — se o cartão tiver uma ou mais checklists no Trello (por exemplo, a lista de
  avarias a resolver), aparecem aqui com uma checkbox por item. Marcar/desmarcar grava de imediato
  (não é preciso clicar em "Guardar alterações" para isto) — dá para ir marcando avarias como
  resolvidas sem sair do dashboard.

Nome, Descrição, Lista e Início gravam juntos ao clicar **"Guardar alterações"**. Há ainda um botão
separado **"Arquivar cartão"** (com confirmação) — o cartão deixa de aparecer no dashboard e nas
listas ativas do Trello, mas não é apagado (continua acessível e recuperável a partir do próprio
Trello).

## Progresso da checklist ("4/8") em cada cartão

Sempre que um cartão tem uma checklist no Trello (por exemplo, uma lista de avarias), aparece um
selo pequeno junto ao nome com a contagem "feitos/total" (ex: "4/8"). Quando fica completo
("8/8"), o selo passa a verde — dá para ver de relance quais os cartões totalmente resolvidos ao
nível da checklist, mesmo sem abrir o cartão. Este selo aparece em todas as páginas com tabelas de
cartões, não só na de edição.

## Coluna "Dias por planear"

Os cartões que ainda não têm data de início (fila de planeamento — Ligeiros em
"Planeamento Interno Ligeiros" e todos os cartões de "Planeamento Interno") mostram a coluna
"Criado em" (data de criação do cartão) e "Dias por planear" (quantos dias já passaram desde essa
criação). Serve para perceber há quanto tempo um trabalho está à espera de ser planeado, já que
ainda não tem uma data de início real associada.

## Página "Falta de Peças"

Lista todos os cartões ativos (em qualquer lista do quadro, não só nas secções já cobertas pelas
outras páginas) que tenham a etiqueta "Falta de Peças" — exceto os que já estão na lista
"Concluído", que ficam de fora mesmo que a etiqueta tenha ficado esquecida no cartão. Além das
colunas habituais, tem uma coluna extra "Com esta etiqueta há" — quanto tempo passou desde que essa
etiqueta foi aplicada ao cartão.

Essa data vem do histórico de atividade do próprio cartão no Trello (o Trello não a devolve no
pedido normal do board, por isso a página faz, só para estes cartões, um pedido adicional por
cartão a consultar esse histórico). Por ser um pedido extra por cartão, só faz sentido aqui — é uma
lista tipicamente pequena (dezenas de cartões, não milhares). Os resultados ficam em cache (3
minutos, tal como o resto dos dados) para não repetir os pedidos a cada visita à página.

Quando o histórico não tem o registo exato (por exemplo, uma etiqueta aplicada há muito tempo, fora
da janela de atividade que o Trello guarda), a coluna mostra a data de criação do cartão como
referência aproximada, assinalada com "*" — tal como acontece em "Dias a decorrer" quando falta a
data de início real.

A tabela começa ordenada pela etiqueta mais antiga primeiro (quem está à espera de peças há mais
tempo no topo); podes reordenar por qualquer coluna clicando no cabeçalho, como nas outras páginas.

## Estado do pedido de material (cruzamento com o quadro "Pedidos Peças")

Sempre que um cartão de equipamento (em qualquer página do dashboard) tiver o campo
personalizado **"Nº Equipamento"** preenchido no Trello, aparece por baixo do nome um ou
mais selos coloridos com o estado do(s) pedido(s) de material desse equipamento no quadro
"Pedidos Peças":

- **A comprar** / **Aguarda cotação** — cinzento, ainda numa fase inicial.
- **Aguarda info EQM** — laranja, pedido à espera de resposta da manutenção.
- **Aguarda Compras** — azul, já respondido pela EQM, à espera de ação das Compras.
- **Encomendado · chega DD/MM/AAAA** — azul mais forte, já encomendado, com a data prevista
  de chegada (vem do campo "Prazo" do cartão em Pedidos Peças).
- **Entregue** — verde, material já levantado.

Se houver mais do que um pedido de material para o mesmo equipamento (por exemplo, uma peça
já entregue e outra ainda em cotação), aparecem todos os selos, um por pedido. Cada selo é
um link direto para o respetivo cartão em "Pedidos Peças". Se um equipamento não tiver
nenhum pedido associado (ou o campo "Nº Equipamento" ainda não estiver preenchido nesse
cartão), simplesmente não aparece selo nenhum — não é erro.

A ligação entre os dois quadros é feita pelo número de equipamento: em OFICINA vem do campo
personalizado "Nº Equipamento" (Custom Field), em Pedidos Peças vem do texto da descrição
("Nº Equipamento: 4039"). Como o João está a preencher o campo personalizado nos cartões
já existentes aos poucos, os selos vão aparecendo progressivamente à medida que cada cartão
for atualizado — não é preciso fazer mais nada do lado do dashboard.

**Nota**: para esta parte funcionar, a conta Trello do key/token configurado precisa de
acesso de leitura ao quadro "Pedidos Peças" também (não só ao OFICINA) — o painel
"Configurar chave/token" lembra isto.

## Ordenação por omissão em "A Decorrer Externo" e "A Decorrer Interno"

Estas duas páginas começam ordenadas do cartão mais antigo para o mais recente — quem está a
decorrer (ou a aguardar planeamento) há mais tempo aparece primeiro, para ser fácil ver o que está
parado há mais tempo sem teres de clicar em nada. Como sempre, clicar num cabeçalho de coluna
reordena a tabela por essa coluna.

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
