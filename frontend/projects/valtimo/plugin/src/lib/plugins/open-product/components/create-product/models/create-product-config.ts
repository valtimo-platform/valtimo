interface CreateProductConfig {
    productNaam: string;
    productTypeUUID: string;
    eigenaarBSN: string;
    eigenaarData: Array<{ key: string; value: string }>;
    gepubliceerd: boolean;
    productPrijs: string;
    frequentie: string;
    status: string;
    resultaatPV: string;
}

export {CreateProductConfig};
