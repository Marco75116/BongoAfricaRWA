import express, { Express, Request, Response } from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { Action, PayloadHttpSms } from "./utils/types/global.type";
import {
  createUser,
  fundWorkflow,
  getCurrentBalance,
  getHistoryTx,
  getPrivateKey,
  historyWorkflow,
  sendTx,
  transferWorkflow,
  withdrawWorkflow,
} from "./utils/helpers/global.helper";
import { getUser } from "./utils/helpers/supabase.helper";
import {
  getCreatedAccountMsg,
  getHelpMsg,
  getReceivedFfundMsg,
} from "./utils/constants/messages.constant";
import {
  getMessageOpenAI,
  modelName,
  openaiClient,
} from "./utils/clients/openai.client";
import { sendMessage } from "./utils/helpers/httpsms.helper";
import { fund, sendXRPLUsd } from "./utils/helpers/ethers.helper";
require("dotenv").config();

const port = process.env.PORT || 6002;

const app = express();
app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.post("/httpsms", async (req, res) => {
  const payload: PayloadHttpSms = req.body;
  console.log(payload.source);
  if (payload.source !== "/v1/messages/receive") {
    console.log("IN");
    return;
  }

  const phoneNumber = payload.data.contact;
  const contentMsgBrut = payload.data.content;

  const user = await getUser(phoneNumber);
  if (!user) {
    const newUser = createUser(phoneNumber);
    const welcomeMsg = getCreatedAccountMsg(newUser.walletAddress);
    sendMessage(phoneNumber, welcomeMsg);
    const helpMsg = getHelpMsg();
    sendMessage(phoneNumber, helpMsg);

    return;
  }
  const contentMsg = `Sctrictly Expected Response Format: Action,Amount,PhoneNumber - User's message: '${contentMsgBrut}'`;

  const msgOpenAI = getMessageOpenAI(contentMsg);

  const response = await openaiClient.chat.completions.create({
    model: modelName,
    messages: msgOpenAI as never,
  });

  console.log(response.choices[0].message);

  if (!response.choices[0].message.content) {
    return;
  }

  const [actionStr, amountExtracted, phoneExtracted]: string[] =
    response.choices[0].message.content.split(",") as any;

  const action = actionStr as Action;

  console.log(action);

  if (action === "Fund") {
    fundWorkflow(phoneNumber);
  }
  if (action === "Transfer") {
    if (amountExtracted === null) {
      const msgAmountExtractedLeft =
        "We understood that you wanted to make a Transfer, but we were unable to identify the amount.";
      sendMessage(phoneNumber, msgAmountExtractedLeft);
      return;
    }
    const currentBalance = await getCurrentBalance(user.walletAddress);
    if (currentBalance < Number(amountExtracted)) {
      sendMessage(
        phoneNumber,
        "Amount to transfer is bigger than your current balance."
      );

      return;
    }
    if (phoneNumber === null) {
      const msgPhoneNumberExtractedLeft =
        "We understood that you wanted to make a Transfer, but we were unable to identify the phone number.";
      sendMessage(phoneNumber, msgPhoneNumberExtractedLeft);
      return;
    }
    transferWorkflow(phoneExtracted, phoneNumber, amountExtracted);
  }
  if (action === "History") {
    historyWorkflow(phoneNumber, user.walletAddress);
  }
  if (action === "Withdraw") {
    if (amountExtracted === null) {
      const msgAmountExtractedLeft =
        "We understood that you wanted to make a withdrawal, but we were unable to identify the amount.";
      sendMessage(phoneNumber, msgAmountExtractedLeft);
      return;
    }
    const currentBalance = await getCurrentBalance(user.walletAddress);
    if (currentBalance < Number(amountExtracted)) {
      sendMessage(
        phoneNumber,
        "Amount to withdraw is bigger than your current balance."
      );

      return;
    }
    withdrawWorkflow(phoneNumber, amountExtracted);
  }
  if (action === null) {
    const noActionMsg =
      "No action has been specified and identified in your previous message. Please rephrase your sentence.";
    sendMessage(phoneNumber, noActionMsg);
  }

  // sendTx(phoneNumber, phoneNumberExacted, amountExtracted);

  // const msgRecipient = getReceivedFfundMsg(phoneNumber, amountExtracted);
  // sendMessage(phoneNumberExacted, msgRecipient);
  // const msgSent = getReceivedFfundMsg(phoneNumberExacted, amountExtracted);
  // sendMessage(phoneNumber, msgSent);

  res.send("Hello World!");
});

app.get("/hey", async (req, res) => {
  const historyMsg =
    " Sctrictly Expected Response Format: Action,Amount,PhoneNumber - User's message: 'Hi I want to know what transaction I made yesterday.'";
  const fundMsg =
    " Sctrictly Expected Response Format: Action,Amount,PhoneNumber - User's message: 'I paid 10 dollars for a code to make money in your app, here is the code: 63738d8rjd.'";
  const withdrawMsg =
    " Sctrictly Expected Response Format: Action,Amount,PhoneNumber - User's message: 'I want to get cash I want to withdraw 20 usd from those tokens in my account'";
  const MsgTranfter =
    " Sctrictly Expected Response Format: Action,Amount,PhoneNumber - User's message: 'I send money to my friend which his number is +335664774647 send him 4 tokens'";
  const msgOpenAI = getMessageOpenAI(fundMsg);

  const response = await openaiClient.chat.completions.create({
    model: modelName,
    messages: msgOpenAI as never,
  });

  console.log(response.choices[0].message);

  if (!response.choices[0].message.content) {
    return;
  }
  const [actionStr, amountExtracted, phoneExtracted]: string[] =
    response.choices[0].message.content.split(",") as any;

  console.log(actionStr === "Fund");

  console.log(actionStr, amountExtracted, phoneExtracted);

  if (!response.choices[0].message.content) {
    return;
  }

  res.send("hello world");
});
app.listen(port, () => console.log("Server running on port 6002"));

async function main() {}

main();
