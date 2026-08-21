import express from "express";
import { calculateHumanDesign } from "natalengine";

const app = express();

app.use(express.json());

app.post("/human-design", (req, res) => {
  try {
    const { birthDate, birthHour, timezone } = req.body;

    const chart = calculateHumanDesign(
      birthDate,
      birthHour,
      timezone
    );

    res.json(chart);
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Venn NatalEngine API running on port ${PORT}`);
});