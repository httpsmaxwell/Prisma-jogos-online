# Prisma · Jogos online

Hub de jogos online para jogar com amigos ou contra o computador, direto no navegador. Sem cadastro e sem instalação.

🌐 **Site:** https://prisma-io.netlify.app/

## Jogos

| Jogo | Descrição | Modos |
|---|---|---|
| **Batalha Naval** | Posicione sua frota e afunde os navios do adversário. | Online (P2P) e contra o computador |
| **Connect Four** | Alinhe quatro peças antes do adversário. | Online (P2P) e contra o computador |
| **Entre Pontos** | Ligue os pontos e feche mais quadrados que o oponente. | Online (P2P) e contra o computador |
| **Jogo da Memória** | Encontre os pares antes do adversário e lembre onde cada carta estava. | Online (P2P) e contra o computador |

## Como jogar online

1. Escolha um jogo na página inicial.
2. Crie uma sala e compartilhe o código com seu amigo.
3. Seu amigo entra com o código e a partida começa.

A conexão é direta entre os navegadores (P2P), via [PeerJS](https://peerjs.com/). O desempenho depende da rede, de firewall e de NAT. Em redes muito restritas, a conexão pode falhar. Detalhes das melhorias e limitações estão em [MELHORIAS.md](MELHORIAS.md).

## Estrutura do projeto

```
prisma/
├── index.html              # Página inicial com a lista de jogos
├── img/                    # Ícones e imagem de pré-visualização (og.jpg)
├── batalha-naval/
│   ├── index.html
│   └── img/
├── connect-four/
│   ├── index.html
│   └── img/
├── entre-pontos/
│   ├── index.html
│   └── img/
├── jogo-da-memoria/
│   ├── index.html
│   └── img/
└── MELHORIAS.md            # Histórico de melhorias e observações técnicas
```

Cada jogo é um arquivo HTML independente, com CSS e JavaScript embutidos. Não há etapa de build nem dependências locais para instalar.

## Como rodar localmente

Como é um site estático, basta abrir o `index.html` no navegador. Para testar o modo online entre duas abas ou dispositivos, use um servidor local, por exemplo:

```bash
npx serve .
```

ou a extensão *Live Server* do VS Code.

## Tecnologias

- HTML, CSS e JavaScript puro
- [PeerJS](https://peerjs.com/) para conexão P2P no modo online
- Hospedagem estática no [Netlify](https://www.netlify.com/)

## Tema

O site segue automaticamente o tema claro ou escuro do sistema operacional.

## Autor

Desenvolvido por **Maxwell** ([@httpsmaxwell](https://github.com/httpsmaxwell)).
