import { useState } from "react";
import {
  findCustomerByMobile,
  attachCustomerToEstimation,
} from "../../utils/customerService";

export function useCustomers() {
  const [loading, setLoading] = useState(false);

  const lookupCustomer = async (mobile) => {
    if (!mobile || mobile.length < 10) return null;
    setLoading(true);
    try {
      return await findCustomerByMobile(mobile);
    } finally {
      setLoading(false);
    }
  };

  const attachCustomer = async (customer, estimation) => {
    setLoading(true);
    try {
      return await attachCustomerToEstimation(customer, estimation);
    } finally {
      setLoading(false);
    }
  };

  return {
    lookupCustomer,
    attachCustomer,
    loading,
  };
}
