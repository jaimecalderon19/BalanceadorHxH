import express from "express";
import axios from "axios";
import cors from "cors";

const router = express.Router();

const MONGO_SERVICE = process.env.MONGO_SERVICE_URL || "http://localhost:4001";
const PG_SERVICE = process.env.PG_SERVICE_URL || "http://localhost:4002";

/**
 * @swagger
 * tags:
 *   name: Balanceador
 *   description: API que unifica Mongo y Postgres
 */

router.get("/cazadores", async (req, res) => {
  try {
    const [mongoResp, pgResp] = await Promise.all([
      axios.get(`${MONGO_SERVICE}/cazadores`),
      axios.get(`${PG_SERVICE}/cazadores`)
    ]);

    const fusionados = [...(mongoResp.data || []), ...(pgResp.data || [])];
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

    // 🔹 Normalización de la respuesta de Mongo
    if (mongoResp.status === "fulfilled" && mongoResp.value.data.found) {
      const data = mongoResp.value.data;
      if (Array.isArray(data.cazadores)) {
        resultados.push(...data.cazadores);
      } else if (data.cazador) {
        resultados.push(data.cazador);
      }
    }

    // 🔹 Normalización de la respuesta de Postgres
    if (pgResp.status === "fulfilled" && pgResp.value.data.found) {
      const data = pgResp.value.data;
      if (Array.isArray(data.cazadores)) {
        resultados.push(...data.cazadores);
      } else if (data.cazador) {
        resultados.push(data.cazador);
      }
    }

    // 🔹 Eliminar duplicados (por nombre o ID)
    const unicos = Array.from(
      new Map(resultados.map(c => [c.nombre || c.id, c])).values()
    );

    if (unicos.length > 0) {
      res.json({ found: true, total: unicos.length, cazadores: unicos });
    } else {
      res.json({ found: false, message: "Cazador no encontrado en ninguno" });
    }
  } catch (err) {
    console.error("❌ Error al buscar cazador:", err.message);
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
