import jwt from "jsonwebtoken";
import asyncHandler from "express-async-handler";
import Customer from "../models/Customer.js";
import { CUSTOMER_COOKIE } from "../controllers/authCustomer.controller.js";

// Gates checkout: a visitor must have completed phone+Telegram verification
// (see authCustomer.controller.js) before an order can be created.
export const protectCustomer = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.[CUSTOMER_COOKIE];

  if (!token) {
    res.status(401);
    throw new Error("Требуется регистрация по телефону");
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const customer = await Customer.findById(decoded.id);
    if (!customer) {
      res.status(401);
      throw new Error("Аккаунт не найден");
    }
    req.customer = customer;
    next();
  } catch (err) {
    res.status(401);
    throw new Error("Сессия истекла, войдите снова");
  }
});
