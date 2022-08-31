import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());



app.listen(5000, () => console.log("Listen on http://localhost:5000"));