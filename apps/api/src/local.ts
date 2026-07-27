import "./load-env";
import { app } from "./app";

const port = Number(process.env.API_PORT ?? 3001);

app.listen(port, () => {
  console.log(`Tablia API disponible en http://localhost:${port}`);
});
