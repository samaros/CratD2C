const hre = require("hardhat");
const ethers = hre.ethers;

const { ADMIN } = process.env;

async function main() {

    const CratToken = await ethers.getContractFactory("CratToken");
    const cratToken = await CratToken.deploy(ADMIN);
    await cratToken.deployed();
    console.log("CratToken deployed, address: ", cratToken.address);
    await new Promise(x => setTimeout(x, 30000));
    await verify(cratToken, [ADMIN]);

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