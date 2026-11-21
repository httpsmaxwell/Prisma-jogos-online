# Prisma — melhorias aplicadas

## Conexão online
- Reconexão do PeerJS ao servidor de sinalização quando ele desconecta, nos dois jogos.
- Mensagens de status mais claras durante reconexão e erros de criação de sala.
- Limpeza do estado de conexão ao fechar o DataConnection.
- IDs de sala com maior espaço de combinação (7 caracteres aleatórios em vez de 5), reduzindo colisões.
- Debug do PeerJS reduzido para evitar logs desnecessários no console.

## Observações importantes
- Os jogos usam conexão P2P via PeerJS. O sucesso de conexão depende de rede, firewall, NAT e disponibilidade dos servidores públicos de sinalização/STUN/TURN configurados.
- O código atual não oferece recuperação completa de uma partida de Batalha Naval após a conexão P2P cair durante o jogo, pois o estado completo da partida não é sincronizado para retomar de forma segura.
- Para confiabilidade maior em redes restritas, o próximo passo é contratar/configurar TURN próprio e implementar protocolo de retomada com sincronização autoritativa da partida.
