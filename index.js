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

// 🔹 OBTENER TODOS
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

// 🔹 BUSCAR
router.get("/cazadores/buscar", async (req, res) => {
  const { nombre } = req.query;
  if (!nombre)
    return res.status(400).json({ error: "Debes proporcionar un nombre" });

  try {
    const [mongoResp, pgResp] = await Promise.allSettled([
      axios.get(`${MONGO_SERVICE}/cazadores/buscar`, { params: { nombre } }),
      axios.get(`${PG_SERVICE}/cazadores/buscar`, { params: { nombre } })
    ]);

    const resultados = [];

    if (mongoResp.status === "fulfilled" && mongoResp.value.data.found) {
      const data = mongoResp.value.data;
      if (Array.isArray(data.cazadores)) resultados.push(...data.cazadores);
      else if (data.cazador) resultados.push(data.cazador);
    }

    if (pgResp.status === "fulfilled" && pgResp.value.data.found) {
      const data = pgResp.value.data;
      if (Array.isArray(data.cazadores)) resultados.push(...data.cazadores);
      else if (data.cazador) resultados.push(data.cazador);
    }

    const unicos = Array.from(
      new Map(resultados.map(c => [c.nombre || c.id, c])).values()
    );

    if (unicos.length > 0)
      res.json({ found: true, total: unicos.length, cazadores: unicos });
    else res.json({ found: false, message: "Cazador no encontrado en ninguno" });
  } catch (err) {
    console.error("❌ Error al buscar cazador:", err.message);
    res.status(500).json({ error: "Error al buscar el cazador" });
  }
});

// 🔹 CREAR
router.post("/cazadores", async (req, res) => {
  try {
    const [mongoResp, pgResp] = await Promise.allSettled([
      axios.post(`${MONGO_SERVICE}/cazadores`, req.body),
      axios.post(`${PG_SERVICE}/cazadores`, req.body)
    ]);

    const resultados = [];
    if (mongoResp.status === "fulfilled") resultados.push(mongoResp.value.data);
    if (pgResp.status === "fulfilled") resultados.push(pgResp.value.data);

    if (resultados.length > 0)
      res.status(201).json({
        message: "Cazador creado en uno o ambos servicios",
        resultados
      });
    else
      res
        .status(500)
        .json({ error: "Error al crear el cazador en ambos servicios" });
  } catch (err) {
    console.error("❌ Error al crear cazador:", err.message);
    res.status(500).json({ error: "Error al crear el cazador" });
  }
});

// 🔹 ACTUALIZAR
router.put("/cazadores/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const [mongoResp, pgResp] = await Promise.allSettled([
      axios.put(`${MONGO_SERVICE}/cazadores/${id}`, req.body),
      axios.put(`${PG_SERVICE}/cazadores/${id}`, req.body)
    ]);

    const resultados = [];
    if (mongoResp.status === "fulfilled") resultados.push(mongoResp.value.data);
    if (pgResp.status === "fulfilled") resultados.push(pgResp.value.data);

    if (resultados.length > 0)
      res.json({
        message: "Cazador actualizado en uno o ambos servicios",
        resultados
      });
    else
      res
        .status(404)
        .json({ error: "Cazador no encontrado en ninguno de los servicios" });
  } catch (err) {
    console.error("❌ Error al actualizar cazador:", err.message);
    res.status(500).json({ error: "Error al actualizar el cazador" });
  }
});

// 🔹 ELIMINAR
router.delete("/cazadores/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const [mongoResp, pgResp] = await Promise.allSettled([
      axios.delete(`${MONGO_SERVICE}/cazadores/${id}`),
      axios.delete(`${PG_SERVICE}/cazadores/${id}`)
    ]);

    const eliminados = [];
    if (mongoResp.status === "fulfilled") eliminados.push(mongoResp.value.data);
    if (pgResp.status === "fulfilled") eliminados.push(pgResp.value.data);

    if (eliminados.length > 0)
      res.json({
        message: "Cazador eliminado en uno o ambos servicios",
        eliminados
      });
    else
      res
        .status(404)
        .json({ error: "Cazador no encontrado en ninguno de los servicios" });
  } catch (err) {
    console.error("❌ Error al eliminar cazador:", err.message);
    res.status(500).json({ error: "Error al eliminar el cazador" });
  }
});

const app = express();
app.use(cors());
app.use(express.json());
app.use("/balanceador", router);

app.listen(process.env.PORT || 5000, () => {
  console.log(`🚀 Balanceador corriendo en puerto ${process.env.PORT || 5000}`);
});

export default app;
