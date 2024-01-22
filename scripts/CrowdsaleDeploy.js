const hre = require("hardhat");
const ethers = hre.ethers;

const { ADMIN, CRAT, USDT, USDC } = process.env;

async function main() {

    const CratCrowdsale = await ethers.getContractFactory("CratCrowdsale");
    const crowdsale = await CratCrowdsale.deploy(ADMIN, CRAT, USDT, USDC);
    await crowdsale.deployed();
    console.log("CratCrowdsale deployed, address: ", crowdsale.address);
    await new Promise(x => setTimeout(x, 30000));
    await verify(crowdsale, [ADMIN, CRAT, USDT, USDC]);

}

async function verify(contract, constructorArguments) {
    await hre.run("verify:verify", {
      address: contract.address,
      constructorArguments: constructorArguments
    })
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});