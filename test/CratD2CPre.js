const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

describe("CratD2CPre", function () {
    async function deployCratTokenFixture() {

        const [admin, user, deployer] = await ethers.getSigners();

        const CratToken = await ethers.getContractFactory("CratD2CPre", deployer);
        const token = await CratToken.deploy(admin.address);
        await token.deployed();

        const initialSupply = await token.PREMINT_AMOUNT();

        const Stablecoin = await ethers.getContractFactory("Stablecoin", admin);
        const usdt = await Stablecoin.deploy(user.address, initialSupply);
        await usdt.deployed();

        const StablecoinTwo = await ethers.getContractFactory("Stablecoin", admin);
        const usdc = await StablecoinTwo.deploy(user.address, initialSupply);
        await usdc.deployed();

        const CratCrowdsale = await ethers.getContractFactory("CratCrowdsale", deployer);
        const sale = await CratCrowdsale.deploy(admin.address, token.address, usdt.address, usdc.address);
        await sale.deployed();

        return { token, admin, user, usdt, initialSupply, sale, deployer };
    }

    async function initializeCratTokenFixture() {

        const [admin, user, deployer] = await ethers.getSigners();

        const CratToken = await ethers.getContractFactory("CratD2CPre", deployer);
        const token = await CratToken.deploy(admin.address);
        await token.deployed();

        const initialSupply = await token.PREMINT_AMOUNT();

        const Stablecoin = await ethers.getContractFactory("Stablecoin", admin);
        const usdt = await Stablecoin.deploy(user.address, initialSupply);
        await usdt.deployed();

        const StablecoinTwo = await ethers.getContractFactory("Stablecoin", admin);
        const usdc = await StablecoinTwo.deploy(user.address, initialSupply);
        await usdc.deployed();

        const CratCrowdsale = await ethers.getContractFactory("CratCrowdsale", deployer);
        const sale = await CratCrowdsale.deploy(admin.address, token.address, usdt.address, usdc.address);
        await sale.deployed();

        return { token, admin, user, sale, usdt, initialSupply, deployer };
    }

    async function bridgeCratTokenFixture() {

        const [admin, user, deployer] = await ethers.getSigners();

        const CratToken = await ethers.getContractFactory("CratD2CPre", deployer);
        const token = await CratToken.deploy(admin.address);
        await token.deployed();

        const initialSupply = await token.PREMINT_AMOUNT();

        const Stablecoin = await ethers.getContractFactory("Stablecoin", admin);
        const usdt = await Stablecoin.deploy(user.address, initialSupply);
        await usdt.deployed();

        const StablecoinTwo = await ethers.getContractFactory("Stablecoin", admin);
        const usdc = await StablecoinTwo.deploy(user.address, initialSupply);
        await usdc.deployed();

        const CratCrowdsale = await ethers.getContractFactory("CratCrowdsale", deployer);
        const sale = await CratCrowdsale.deploy(admin.address, token.address, usdt.address, usdc.address);
        await sale.deployed();

        const Bridge = await ethers.getContractFactory("Bridge", admin);
        const bridge = await Bridge.deploy(token.address);
        await bridge.deployed();

        return { token, admin, user, sale, bridge, usdt, initialSupply, deployer };
    }

    describe("Access", function () {
        it("Should right supply after deploy", async function () {
            const { token, initialSupply } = await loadFixture(deployCratTokenFixture);

            expect(await token.totalSupply()).to.equal(initialSupply);
        });

        it("Should revert transfer by user", async function () {
            const { token, user } = await loadFixture(deployCratTokenFixture);

            const amount = 1;

            await expect(token.connect(user).transfer(token.address, amount)).to.be.revertedWith(
                "CratD2CPre: invalid call"
            );
        });

        it("Should revert transferFrom by user", async function () {
            const { token, user, deployer } = await loadFixture(deployCratTokenFixture);

            const amount = 1;

            await token.connect(deployer).approve(user.address, amount);

            await expect(token.connect(user).transferFrom(deployer.address, user.address, amount)).to.be.revertedWith(
                "CratD2CPre: invalid call"
            );
        });

        it("Should pass transfer by user to admin", async function () {
            const { token, user, admin } = await loadFixture(deployCratTokenFixture);

            const amount = 1000;

            await token.connect(admin).transfer(user.address, amount);

            await token.connect(user).transfer(admin.address, amount);
        });

        it("Should pass transferFrom by user from admin", async function () {
            const { token, user, admin } = await loadFixture(deployCratTokenFixture);

            const amount = 1000;

            await token.connect(admin).transfer(user.address, amount);

            await token.connect(admin).approve(user.address, amount);

            await token.connect(user).transferFrom(admin.address, user.address, amount);
        });

        it("Should pass burn by user", async function () {
            const { token, user, admin } = await loadFixture(deployCratTokenFixture);

            const amount = 1000;

            await token.connect(admin).transfer(user.address, amount);

            await token.connect(user).burn(amount);
        });

        it("Should right admin role", async function () {
            const { token, admin } = await loadFixture(initializeCratTokenFixture);

            const defaultRole = token.DEFAULT_ADMIN_ROLE();
            expect(await token.hasRole(defaultRole, admin.address)).to.equal(true);
        });

        it("Should pass transfer by admin to crowdsale", async function () {
            const { token, admin, sale, initialSupply } = await loadFixture(initializeCratTokenFixture);

            const amount = 1000;

            await token.connect(admin).transfer(sale.address, amount);

            expect(await token.balanceOf(admin.address)).to.equal(initialSupply.sub(amount));
            expect(await token.balanceOf(sale.address)).to.equal(amount);
        });

        it("Should pass transfer by crowdsale after setup", async function () {
            const { token, admin, sale, user, usdt, initialSupply } = await loadFixture(initializeCratTokenFixture);

            const stablesAmount = 10000;

            const tokensAmount = await sale.calculateTokensAmount(stablesAmount);
            await token.connect(admin).transfer(sale.address, tokensAmount);

            const crowdsaleRole = await token.CROWDSALE_ROLE();

            await token.connect(admin).grantRole(crowdsaleRole, sale.address);
            await usdt.connect(user).approve(sale.address, initialSupply);
            await sale.connect(user).buyCratTokens(usdt.address, stablesAmount, user.address, 0);

            expect(await token.balanceOf(user.address)).to.equal(tokensAmount);
            expect(await token.balanceOf(sale.address)).to.equal(0);
        });

        it("Should revert transfer to crowdsale by user", async function () {
            const { sale, token, user, admin } = await loadFixture(bridgeCratTokenFixture);

            const amount = 1000;

            await token.connect(admin).transfer(user.address, amount);
            await token.connect(admin).transfer(sale.address, amount);

            const crowdsaleRole = await token.CROWDSALE_ROLE();

            await token.connect(admin).grantRole(crowdsaleRole, sale.address);

            await expect(token.connect(user).transfer(sale.address, amount)).to.be.revertedWith(
                "CratD2CPre: invalid call"
            );
        });

        it("Should pass transfer to bridge by user", async function () {
            const { bridge, token, user, admin } = await loadFixture(bridgeCratTokenFixture);

            const amount = 1000;

            await token.connect(admin).transfer(user.address, amount);

            const bridgeRole = await token.BRIDGE_ROLE();
            await token.connect(admin).grantRole(bridgeRole, bridge.address);

            await token.connect(user).transfer(bridge.address, amount);

            expect(await token.balanceOf(bridge.address)).to.equal(amount);
            expect(await token.balanceOf(user.address)).to.equal(0);
        });

        it("Should revert transferfrom by bridge before role setup", async function () {
            const { sale, token, user, usdt, initialSupply, admin, bridge } = await loadFixture(bridgeCratTokenFixture);

            const stablesAmount = 1000;
            const tokensAmount = await sale.calculateTokensAmount(stablesAmount);

            await token.connect(admin).transfer(user.address, tokensAmount);
            await token.connect(admin).transfer(sale.address, tokensAmount);

            const crowdsaleRole = await token.CROWDSALE_ROLE();

            await token.connect(admin).grantRole(crowdsaleRole, sale.address);
            await usdt.connect(user).approve(sale.address, initialSupply);
            await sale.connect(user).buyCratTokens(usdt.address, stablesAmount, user.address, 0);

            await token.connect(user).approve(bridge.address, tokensAmount);

            await expect(bridge.connect(user).swap(stablesAmount)).to.be.revertedWith(
                "CratD2CPre: invalid call"
            );
        });

        it("Should pass transferfrom by bridge", async function () {
            const { user, sale, token, admin, initialSupply, usdt, bridge } = await loadFixture(bridgeCratTokenFixture);

            const stablesAmount = 1000;
            const tokensAmount = await sale.calculateTokensAmount(stablesAmount);

            await token.connect(admin).transfer(user.address, tokensAmount);
            await token.connect(admin).transfer(sale.address, tokensAmount);

            const crowdsaleRole = token.CROWDSALE_ROLE();
            await token.connect(admin).grantRole(crowdsaleRole, sale.address);

            const bridgeRole = token.BRIDGE_ROLE();
            await token.connect(admin).grantRole(bridgeRole, bridge.address);

            await usdt.connect(user).approve(sale.address, initialSupply);
            await sale.connect(user).buyCratTokens(usdt.address, stablesAmount, user.address, 0);

            await token.connect(user).approve(bridge.address, tokensAmount);
            await bridge.connect(user).swap(tokensAmount);

            expect(await token.balanceOf(bridge.address)).to.equal(tokensAmount);
            expect(await token.hasRole(bridgeRole, bridge.address)).to.equal(true);
        });
    });
});