# With Love - Star Scatter & Frame Photo Editor

Aplicación web interactiva para edición estética de fotos con marcos temáticos, dispersión de estrellas (*star scatter / polka dots*), personalización de papel y visualización en tarjeta 3D interactiva.

## Características

- 📸 **Cámara y Carga de Fotos:** Vista previa en vivo con marco superpuesto, captura y carga desde la biblioteca local.
- 🖼️ **79 Marcos (Cutout SVGs):** Gran variedad de estilos (Classic, Star, Heart, Y2K, Sparkle, Grid, Vintage, etc.).
- 📜 **Texturas y Colores de Papel:** Selección de papel y colores con revelado de alta fidelidad.
- 🃏 **Tarjeta 3D Interactiva:** Rotación con arrastre táctil/ratón, balanceo suave y giro 3D de 180° entre frente y reverso.
- 💾 **Exportación en Alta Calidad:** Generación y descarga directa en resolución 1080×1350 (PNG).
- ⚡ **100% Autónomo / Cliente:** Sin dependencias de servicios externos ni backend; funciona totalmente offline.

## Cómo ejecutar localmente

### En Windows:
Simplemente haz doble clic en `iniciar.bat` (o `start.bat`). Se iniciará el servidor local y abrirá tu navegador automáticamente en `http://localhost:8000/`.

### Con Python o Node:
```bash
# Con Python:
python -m http.server 8000

# O con Node:
npx serve -p 8000 .
```
Luego abre `http://localhost:8000/` en tu navegador.
