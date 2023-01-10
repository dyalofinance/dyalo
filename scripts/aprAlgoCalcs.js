//const prices = [2686,2920,3281,2726,1941,1071,1678,1554,1328,1572,1294,1196];
//const sum = priceHistory.reduce((accumulator, value) => accumulator + value, 0);
//const averagePrice = sum / 12;
const prices = [10,100,250,500,750,900,1000,1100,1250,1500,1900,2000,3000,5000,8000,10000];
const averagePrice = 1000;
prices.forEach((ethDollarPrice) => {
  //const aprBasisPoints = ((averagePrice * 6) - ethDollarPrice) / 9;
  let formula = 200;
  for (let f = 1; f < 17; f++) {
    if (ethDollarPrice < averagePrice * f / 8) formula += 100;      
    if (ethDollarPrice < averagePrice / f / 64) formula += 100;
  }
  //if (ethDollarPrice < averagePrice * 2) formula += 200;
  //if (ethDollarPrice < averagePrice) formula += 200;
  //if (ethDollarPrice < averagePrice / 2) formula += 400;
  console.log(`Price: $${ethDollarPrice}${"\t"}APR: ${(formula / 100).toFixed()}%`);
});
