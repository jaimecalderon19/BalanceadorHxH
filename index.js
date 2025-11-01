import express from "express";
import axios from "axios";
import cors from "cors";

const router = express.Router();

// URLs de los servicios base
const MONGO_SERVICE = process.env.MONGO_SERVICE_URL || "http://localhost:4001";
const PG_SERVICE = process.env.PG_SERVICE_URL || "http://localhost:4002";

/**
 * @swagger
 * tags:
 *   name: Balanceador
 *   description: API que unifica Mongo y Postgres
 */

/**
 * @swagger
 * /balanceador/cazadores:
 *   get:
 *     summary: Obtiene todos los cazadores desde Mongo y Postgres
 *     tags: [Balanceador]
 *     responses:
 *       200:
 *         description: Lista combinada de cazadores
 */
router.get("/cazadores", async (req, res) => {
  try {
    const [mongoResp, pgResp] = await Promise.all([
      axios.get(`${MONGO_SERVICE}/cazadores`),
      axios.get(`${PG_SERVICE}/cazadores`)
    ]);

    // Fusionar resultados (puedes definir tu propia lógica)
    const fusionados = [...mongoResp.data, ...pgResp.data];

    res.json({ total: fusionados.length, cazadores: fusionados });
  } catch (err) {
    console.error("❌ Error al fusionar datos:", err.message);
    res.status(500).json({ error: "Error al obtener datos de ambos servicios" });
  }
});

/**
 * @swagger
 * /balanceador/cazadores/buscar:
 *   get:
 *     summary: Busca un cazador en ambos servicios
 *     tags: [Balanceador]
 *     parameters:
 *       - in: query
 *         name: nombre
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Resultado combinado
 */
router.get("/cazadores/buscar", async (req, res) => {
  const { nombre } = req.query;
  if (!nombre) return res.status(400).json({ error: "Debes proporcionar un nombre" });

  try {
    const [mongoResp, pgResp] = await Promise.allSettled([
      axios.get(`${MONGO_SERVICE}/cazadores/buscar`, { params: { nombre } }),
      axios.get(`${PG_SERVICE}/cazadores/buscar`, { params: { nombre } })
    ]);

    const resultados = [];

    if (mongoResp.status === "fulfilled" && mongoResp.value.data.found)
      resultados.push(mongoResp.value.data.cazador);
    if (pgResp.status === "fulfilled" && pgResp.value.data.found)
      resultados.push(pgResp.value.data.cazador);

    if (resultados.length > 0) {
      res.json({ found: true, cazadores: resultados });
    } else {
      res.json({ found: false, message: "Cazador no encontrado en ninguno" });
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error al buscar el cazador" });
  }
});


const app = express();
app.use(cors());
app.use(express.json());

app.use("/balanceador", router);

app.listen(process.env.PORT || 5000, () => {
  console.log(`🚀 Balanceador corriendo en puerto ${process.env.PORT || 5000}`);
});

