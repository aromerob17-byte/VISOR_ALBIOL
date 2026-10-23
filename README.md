# VISOR ALBIOL
Observatorio independiente de conversación pública en X acerca de Xavier García Albiol. Repositorio único para recopilación, histórico, procesado y web. **No modifica ni depende de los repositorios del Pulso Joven.**

## Página web
La aplicación está en \`web/\`. Visualiza:
- Indicadores de publicaciones únicas, autores, interacciones, impresiones y actividad de Albiol.
- Evolución temporal por fecha y composición en castellano, catalán, mixto y otros idiomas.
- Temáticas (clasificador experimental por palabras clave) y tipología: respuestas, citas y originales.
- **Top 10 de publicaciones del periodo**, de todas las cuentas según interacciones, impresiones, me gusta, reposts, respuestas o citas.
- **Top 10 de publicaciones propias de Albiol** con las mismas métricas.
- Filtro lingüístico común a indicadores, temáticas y rankings.

Ninguna cuenta ni ninguna publicación de terceros recibe prioridad en el top 10. Los rankings numéricos solo describen métricas observadas; no valoran posiciones políticas ni representan encuestas.

## Publicación
\`npm test\` valida los datos y el procesador; \`npm run process\` genera \`data/public/resumen.json\` desde el histórico local; \`npm run site\` construye \`dist/\`. **Ninguno de esos comandos consulta X ni consume créditos.**

El flujo **Publicar Visor Albiol** se activa al actualizar la web o el histórico. Es necesario habilitar una vez **Settings → Pages → Build and deployment → Source: GitHub Actions**. Después se puede reejecutar el flujo desde **Actions**.

No subir tokens a ficheros. El secreto \`X_BEARER_TOKEN\` debe permanecer en GitHub Secrets. La publicación web solo contiene resúmenes e identificadores de los mensajes destacados, no la base íntegra de textos.

## Histórico y costes
Inicio: **21/10/2026 00:00 Europe/Madrid**. Las búsquedas incluyen "Albiol", menciones directas, actividad propia, respuestas y citas de conversaciones seguidas. La recogida utiliza la API X y puede tener coste; **no hay programación automática de recopilación**. Los mensajes con el mismo ID se deduplican y las republicaciones se excluyen de los rankings de posts propios y generales. Las métricas provienen del último snapshot.

Las respuestas a hilos externos pueden ser off-topic. Los resultados describen exclusivamente las publicaciones capturadas y no representan a todos los ciudadanos.

Consultar \`ARCHITECTURE.md\` para el detalle del almacenamiento.
