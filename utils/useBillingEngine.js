const calculateItemBase = (item) => {
  const net = Number(item.netWeight || 0);
  const rate = Number(item.rate || 0);
  const stone = Number(item.stoneCharges || 0);
  const mc = Number(item.makingChargeValue || 0);

  let value = net * rate;

  if (item.makingChargeType === "GRAM") {
    value += mc * rate;
  }

  if (item.makingChargeType === "PERCENT") {
    value += value * (mc / 100);
  }

  return value + stone;
};

const calculateBilling = (items, redeem, exchange, discount, paid) => {
  const subtotal = items.reduce((s, i) => s + calculateItemBase(i), 0);

  const cgst = subtotal * 0.015;
  const sgst = subtotal * 0.015;

  const final =
    subtotal + cgst + sgst - redeem - exchange - discount;

  const balance = Math.max(final - paid, 0);

  return { subtotal, cgst, sgst, final, balance };
};
