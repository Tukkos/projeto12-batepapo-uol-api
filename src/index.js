import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient, ObjectId } from "mongodb";
import dayjs from "dayjs";
import joi from "joi";

let now = dayjs();
const time = now.format("HH:mm:ss");
const app = express();
app.use(cors());
app.use(express.json());
dotenv.config();

const mongoCLient = new MongoClient(process.env.MONGO_URI);
let db;
mongoCLient.connect().then(() => {
    db = mongoCLient.db("batePapoUol");
});

const participantsSchema = joi.object({
    name: joi.string().required()
});

const messagesSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().required().valid("message", "private_message")
});

function filterEverybody(message) {
    return message.type === "message";
};

function filterStatus(message) {
    return message.type === "status";
};

function filterPrivate(message, user) {
    return message.type === "private_message" && message.from === user || message.to === user;
};

app.post("/participants", async (req, res) => {
    const { name } = req.body;

    const validation = participantsSchema.validate(req.body);
    if (validation.error) {
        return res.status(422).send(validation.error.details[0].message);
    }

    //Forma verbosa------------------------------------------------------------------
    // const participants = await db.collection("participants").find().toArray();
    // for (let i = 0; i < participants.length; i++) {
    //     if (name === participants[i].name) {
    //         return res.status(409).send("Usuário já existente");
    //     }
    // };
    //Forma refatorada---------------------------------------------------------------
    const participants = await db.collection("participants").find().toArray();
    if (participants.find(participant => participant.name === name)) {
        return res.status(409).send("Usuário já existente");
    };

    try {
        await db.collection("participants").insertOne({
            name,
            lastStatus: Date.now()
        });
        await db.collection("messages").insertOne({
            name,
            to: "Todos",
            text: "entra na sala...",
            type: "status",
            time: time
        });
        res.sendStatus(201);
    } catch (error) {
        res.send(500).send(error.message);
    };
});

app.get("/participants", async (req, res) => {
    try {
        const participants = await db.collection("participants").find().toArray();
        res.send(participants);
    } catch (error) {
        res.send(500).send(error.message);
    };
});

setInterval(deleteInactives, 15000);

async function deleteInactives() {
    const participants = await db.collection("participants").find().toArray();
    for (let i = 0; i < participants.length; i++) {
        if (Date.now() - participants[i].lastStatus > 10000) {
            await db.collection("participants").deleteOne({ _id: new ObjectId(participants[i]._id)});
            await db.collection("messages").insertOne({
                name: participants[i].name,
                to: "Todos",
                text: "sai da sala...",
                type: "status",
                time: time
            });
        };
    };
    console.log("Inactives Deleted");
};

// app.delete("/participants", async (req, res) => {
//     try {
//         const participants = await db.collection("participants").find().toArray();
//         for (let i = 0; i < participants.length; i++) {
//             if (Date.now() - participants[i].lastStatus > 10000) {
//                 await db.collection("participants").deleteOne({ _id: new ObjectId(participants[i]._id)});
//                 await db.collection("messages").insertOne({
//                     name: participants[i].name,
//                     to: "Todos",
//                     text: "sai da sala...",
//                     type: "status",
//                     time: time
//                 });
//             };
//         };
//         return res.sendStatus(200);
//     } catch (error) {
//         res.send(500).send(error.message);
//     };  
// });

app.post("/messages", async (req, res) => {
    const user = req.headers.user;
    const { to, text, type } = req.body;

    const validation = messagesSchema.validate(req.body, {abortEarly: false});
    if (validation.error) {
        const error = validation.error.details.map(detail => detail.message);
        return res.status(422).send(error);
    };

    const participants = await db.collection("participants").find().toArray();
    if (!participants.find(participant => participant.name === user)) {
        return res.status(422).send("Erro de usuário");
    };

    try {
        await db.collection("messages").insertOne({
            from: user,
            to,
            text,
            type,
            time: time
        });
        res.sendStatus(201);
    } catch (error) {
        res.send(500).send(error.message);
    }
    
});

app.get("/messages", async (req, res) => {
    const messages = await db.collection("messages").find().toArray();
    let { limit } = req.query;
    const user = req.headers.user;

    const messagesFiltered = messages.filter(message => {
        return (
            filterStatus(message) ||
            filterEverybody(message) ||
            filterPrivate(message, user)
        );
    });
    
    if (!limit) {
        return res.send(messagesFiltered);
    }
    return res.send(messagesFiltered.slice(-limit));
});

app.post("/status", async (req, res) => {
    const name = req.headers.user;
    
    const participants = await db.collection("participants").find().toArray();
    if (!participants.find(participant => participant.name === name)) {
        return res.sendStatus(404);
    };
    try {
        await db.collection("participants").insertOne({
            name: name,
            lastStatus: Date.now()
        });
        res.sendStatus(200);
    } catch (error) {
        res.send(500).send(error.message);
    };
});

app.listen(5000, () => console.log("Listen on http://localhost:5000"));