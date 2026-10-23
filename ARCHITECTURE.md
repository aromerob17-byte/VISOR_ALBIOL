# Arquitectura — Visor Albiol

Un único repositorio; totalmente independiente de los dos repositorios del Pulso Joven.

**Inicio:** 21/10/2026 a las 00:00, hora peninsular, convertido a UTC en config/fuentes.json.

**Fuentes:** palabra Albiol en cualquier cuenta, mención a la cuenta, actividad propia de Albiol, respuestas directas, respuestas/citas de hilos relevantes. El ID de la publicación es clave única y las procedencias múltiples se conservan.

**Persistencia:** data/posts/YYYY-MM.json almacena registros originales con metadatos, idioma de X y aproximación lingüística propia; data/metrics/YYYY-MM.json almacena mediciones cuando cambian. El estado de cada fuente se mantiene en data/estado.json, y los resúmenes de navegación en data/public/resumen.json. No se publican los textos originales en GitHub Pages.

**Costes:** recopilación exclusivamente manual, 10 peticiones máximas, 500 resultados máximos y dos páginas por fuente inicialmente. Son límites técnicos, NO un presupuesto monetario absoluto. No ejecutar sin revisar tarifas y créditos de X.

**Recopilación y cobertura:** búsqueda reciente con paginación y fecha incremental cuando una fuente se completa. Si el lote queda truncado, NO se avanza el cursor de la fuente. Las citas se consultan por endpoint específico. Para profundizar en un hilo se necesita consulta por conversation_id; no se supone que toda respuesta sea relevante. Sin acceso histórico no se puede recuperar indefinidamente octubre de 2026.

**Análisis:** volumen, autores, tendencias, clasificación lingüística castellano/catalán/mixto/otros e indeterminado, interacción, temas por palabras clave. En este primer esqueleto NO se calcula opinión favorable/desfavorable por falta de método validado. El visor publica análisis descriptivo de X, no encuestas ni estimaciones electorales.

**Flujos:** pruebas automáticas sin llamadas a X; recopilación manual con API y almacenamiento; publicación manual a GitHub Pages. Pages requiere escoger la fuente GitHub Actions en Settings > Pages. Nunca meter el token en el repositorio.
