const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const withDecimals = ethers.utils.parseEther;

describe("CratCrowdsale", function () {
    async function deployCrowdsaleFixture() {

        const [admin, userOne, userTwo, deployer] = await ethers.getSigners();

        const CratToken = await ethers.getContractFactory("CratD2CPre", admin);
        const token = await CratToken.deploy(admin.address);
        await token.deployed();

        const amountToMint = await token.PREMINT_AMOUNT();

        const Stablecoin = await ethers.getContractFactory("Stablecoin", admin);
        const usdt = await Stablecoin.deploy(userOne.address, amountToMint);
        await usdt.deployed();

        const StablecoinTwo = await ethers.getContractFactory("Stablecoin", admin);
        const usdc = await StablecoinTwo.deploy(userOne.address, amountToMint);
        await usdc.deployed();

        const userBalance = amountToMint.div(2);

        await usdt.connect(userOne).transfer(userTwo.address, userBalance);
        await usdc.connect(userOne).transfer(userTwo.address, userBalance);

        const CratCrowdsale = await ethers.getContractFactory("CratCrowdsale", deployer);
        const sale = await CratCrowdsale.deploy(admin.address, token.address, usdt.address, usdc.address);
        await sale.deployed();

        const crowdsaleRole = await token.CROWDSALE_ROLE();
        await token.connect(admin).transfer(sale.address, amountToMint);
        await token.connect(admin).grantRole(crowdsaleRole, sale.address);

        return { token, usdt, usdc, sale, admin, userOne, userTwo, amountToMint, userBalance };
    }

    async function oneBuyInstantBonus(stablesToPay, craftTokensAmount, craftBonusStablesAmount, craftBonusTokensAmount) {
        const { token, sale, usdt, userOne } = await loadFixture(deployCrowdsaleFixture);

        const saleUsdtBalanceBefore = await usdt.balanceOf(sale.address);
        const userUsdtBalanceBefore = await usdt.balanceOf(userOne.address);
        const saleCratBalanceBefore = await token.balanceOf(sale.address);
        const userCratBalanceBefore = await token.balanceOf(userOne.address);
        const totalRaisedBefore = await sale.totalFundsRaised();

        const tokensAmount = await sale.calculateTokensAmount(stablesToPay);
        const craftTotalTokensAmount = tokensAmount.add(craftBonusTokensAmount);
        const bonusTokensAmount = await sale.calculateTokensAmount(craftBonusStablesAmount)

        expect(tokensAmount).to.equal(craftTokensAmount);
        expect(craftBonusTokensAmount).to.equal(bonusTokensAmount);
        expect(totalRaisedBefore).to.equal(0);

        await usdt.connect(userOne).approve(sale.address, stablesToPay);
        await sale.connect(userOne).buyCratTokens(usdt.address, stablesToPay, userOne.address, await sale.calculateReferralRefundAmount(userOne.address, userOne.address, stablesToPay));

        const saleUsdtBalanceAfter = await usdt.balanceOf(sale.address);
        const userUsdtBalanceAfter = await usdt.balanceOf(userOne.address);
        const saleCratBalanceAfter = await token.balanceOf(sale.address);
        const userCratBalanceAfter = await token.balanceOf(userOne.address);
        const totalRaisedAfter = await sale.totalFundsRaised();
        expect(totalRaisedAfter).to.equal(stablesToPay);

        expect(saleUsdtBalanceBefore.add(stablesToPay)).to.equal(saleUsdtBalanceAfter);
        expect(userUsdtBalanceBefore.sub(stablesToPay)).to.equal(userUsdtBalanceAfter);
        expect(saleCratBalanceBefore.sub(craftTotalTokensAmount)).to.equal(saleCratBalanceAfter);
        expect(userCratBalanceBefore.add(craftTotalTokensAmount)).to.equal(userCratBalanceAfter);
    }

    async function doubleBuyWithDoubleBonus(
        stablesToPay, craftTokensAmount, craftBonusStablesAmount, craftBonusTokensAmount,
        stablesToPayTwo, craftTokensAmountTwo, craftBonusStablesAmountTwo, craftBonusTokensAmountTwo) {
        const { token, sale, usdt, userOne } = await loadFixture(deployCrowdsaleFixture);

        const saleUsdtBalanceBefore = await usdt.balanceOf(sale.address);
        const userUsdtBalanceBefore = await usdt.balanceOf(userOne.address);
        const saleCratBalanceBefore = await token.balanceOf(sale.address);
        const userCratBalanceBefore = await token.balanceOf(userOne.address);
        const userInfoBefore = await sale.userInfo(userOne.address);
        const totalRaisedBefore = await sale.totalFundsRaised();

        expect(totalRaisedBefore).to.equal(0);
        expect(userInfoBefore.bonusTokensReceived).to.equal(0);
        expect(userInfoBefore.referralReceived).to.equal(0);
        expect(userInfoBefore.totalSpend).to.equal(0);

        const tokensAmount = await sale.calculateTokensAmount(stablesToPay);
        const craftTotalTokensAmount = tokensAmount.add(craftBonusTokensAmount);
        const bonusTokensAmount = await sale.calculateTokensAmount(craftBonusStablesAmount);

        expect(tokensAmount).to.equal(craftTokensAmount);
        expect(craftBonusTokensAmount).to.equal(bonusTokensAmount);

        await usdt.connect(userOne).approve(sale.address, stablesToPay);
        await sale.connect(userOne).buyCratTokens(usdt.address, stablesToPay, userOne.address, await sale.calculateReferralRefundAmount(userOne.address, userOne.address, stablesToPay));

        const saleUsdtBalanceAfter = await usdt.balanceOf(sale.address);
        const userUsdtBalanceAfter = await usdt.balanceOf(userOne.address);
        const saleCratBalanceAfter = await token.balanceOf(sale.address);
        const userCratBalanceAfter = await token.balanceOf(userOne.address);
        const userInfoAfter = await sale.userInfo(userOne.address);
        const totalRaisedAfter = await sale.totalFundsRaised();
        expect(totalRaisedAfter).to.equal(stablesToPay);

        expect(userInfoAfter.bonusTokensReceived).to.equal(bonusTokensAmount);
        expect(userInfoAfter.referralReceived).to.equal(0);
        expect(userInfoAfter.totalSpend).to.equal(stablesToPay);

        expect(saleUsdtBalanceBefore.add(stablesToPay)).to.equal(saleUsdtBalanceAfter);
        expect(userUsdtBalanceBefore.sub(stablesToPay)).to.equal(userUsdtBalanceAfter);
        expect(saleCratBalanceBefore.sub(craftTotalTokensAmount)).to.equal(saleCratBalanceAfter);
        expect(userCratBalanceBefore.add(craftTotalTokensAmount)).to.equal(userCratBalanceAfter);

        const tokensAmountTwo = await sale.calculateTokensAmount(stablesToPayTwo);
        const craftTotalTokensAmountTwo = tokensAmountTwo.add(craftBonusTokensAmountTwo);
        const bonusTokensAmountTwo = await sale.calculateTokensAmount(craftBonusStablesAmountTwo);

        expect(tokensAmountTwo).to.equal(craftTokensAmountTwo);
        expect(bonusTokensAmountTwo).to.equal(craftBonusTokensAmountTwo);

        await usdt.connect(userOne).approve(sale.address, stablesToPayTwo);
        await sale.connect(userOne).buyCratTokens(usdt.address, stablesToPayTwo, userOne.address, await sale.calculateReferralRefundAmount(userOne.address, userOne.address, stablesToPayTwo));

        const saleUsdtBalanceAfterTwo = await usdt.balanceOf(sale.address);
        const userUsdtBalanceAfterTwo = await usdt.balanceOf(userOne.address);
        const saleCratBalanceAfterTwo = await token.balanceOf(sale.address);
        const userCratBalanceAfterTwo = await token.balanceOf(userOne.address);
        const userInfoAfterTwo = await sale.userInfo(userOne.address);
        const totalRaisedAfterTwo = await sale.totalFundsRaised();
        expect(totalRaisedAfterTwo).to.equal(stablesToPay.add(stablesToPayTwo));

        expect(userInfoAfterTwo.bonusTokensReceived).to.equal(bonusTokensAmount.add(bonusTokensAmountTwo));
        expect(userInfoAfterTwo.referralReceived).to.equal(0);
        expect(userInfoAfterTwo.totalSpend).to.equal(stablesToPay.add(stablesToPayTwo));

        expect(saleUsdtBalanceAfter.add(stablesToPayTwo)).to.equal(saleUsdtBalanceAfterTwo);
        expect(userUsdtBalanceAfter.sub(stablesToPayTwo)).to.equal(userUsdtBalanceAfterTwo);
        expect(saleCratBalanceAfter.sub(craftTotalTokensAmountTwo)).to.equal(saleCratBalanceAfterTwo);
        expect(userCratBalanceAfter.add(craftTotalTokensAmountTwo)).to.equal(userCratBalanceAfterTwo);
    }

    async function updatePriceOnePayment(tokensToBuy, priceTarget) {
        const { sale, usdt, userTwo } = await loadFixture(deployCrowdsaleFixture);

        const initPrice = withDecimals("0.2");
        const priceBefore = await sale.currentTokenPrice();

        expect(initPrice).to.equal(priceBefore);

        const stableAmount = await sale.calculateStableAmount(tokensToBuy);

        await usdt.connect(userTwo).approve(sale.address, stableAmount);
        await sale.connect(userTwo).buyCratTokens(usdt.address, stableAmount, userTwo.address, await sale.calculateReferralRefundAmount(userTwo.address, userTwo.address, stableAmount));

        const priceAfter = await sale.currentTokenPrice();

        expect(priceAfter).to.equal(priceTarget);
    }

    async function updatePriceMultiPayments(tokensToBuyOne, tokensToBuyTwo, tokensToBuyThree, tokensToBuyFour, finishPriceTarget) {
        const { sale, usdt, userOne, userTwo } = await loadFixture(deployCrowdsaleFixture);

        const totalRaisedBefore = await sale.totalFundsRaised();
        expect(totalRaisedBefore).to.equal(0);

        const initPrice = withDecimals("0.2");
        const priceBefore = await sale.currentTokenPrice();

        expect(initPrice).to.equal(priceBefore);

        const stableAmountOne = await sale.calculateStableAmount(tokensToBuyOne);
        await usdt.connect(userTwo).approve(sale.address, stableAmountOne);
        await sale.connect(userTwo).buyCratTokens(usdt.address, stableAmountOne, userTwo.address, await sale.calculateReferralRefundAmount(userTwo.address, userTwo.address, stableAmountOne));

        const stableAmountTwo = await sale.calculateStableAmount(tokensToBuyTwo);
        await usdt.connect(userOne).approve(sale.address, stableAmountTwo);
        await sale.connect(userOne).buyCratTokens(usdt.address, stableAmountTwo, userOne.address, await sale.calculateReferralRefundAmount(userOne.address, userOne.address, stableAmountTwo));

        const stableAmountThree = await sale.calculateStableAmount(tokensToBuyThree);
        await usdt.connect(userTwo).approve(sale.address, stableAmountThree);
        await sale.connect(userTwo).buyCratTokens(usdt.address, stableAmountThree, userTwo.address, await sale.calculateReferralRefundAmount(userTwo.address, userTwo.address, stableAmountThree));

        const stableAmountFour = await sale.calculateStableAmount(tokensToBuyFour);
        await usdt.connect(userOne).approve(sale.address, stableAmountFour);
        await sale.connect(userOne).buyCratTokens(usdt.address, stableAmountFour, userOne.address, await sale.calculateReferralRefundAmount(userOne.address, userOne.address, stableAmountFour));

        const priceAfter = await sale.currentTokenPrice();
        expect(priceAfter).to.equal(finishPriceTarget);
        const totalRaisedAfter = await sale.totalFundsRaised();
        expect(totalRaisedAfter).to.equal(stableAmountOne.add(stableAmountTwo).add(stableAmountThree).add(stableAmountFour));
    }

    async function oneBuyReferral(tokensToBuy, craftStableAmount, craftBonusStablesAmount, craftBonusTokensAmount,
        token, sale, usdt, userOne, userTwo, fatherAddress, craftRefundAmount) {

        const tokensToBuyUserTwo = withDecimals("1000");
        await usdt.connect(userTwo).approve(sale.address, tokensToBuyUserTwo);
        await sale.connect(userTwo).buyCratTokens(usdt.address, tokensToBuyUserTwo, userTwo.address, await sale.calculateReferralRefundAmount(userTwo.address, userTwo.address, tokensToBuyUserTwo));

        const maxInterest = await sale.MAX_REFUND_INTEREST();
        const initInterest = await sale.referralRefundInterest();
        expect(initInterest).to.equal(1000);
        expect(maxInterest).to.equal(10000);

        const saleUsdtBalanceBefore = await usdt.balanceOf(sale.address);
        const userUsdtBalanceBefore = await usdt.balanceOf(userOne.address);
        const fatherUsdtBalanceBefore = await usdt.balanceOf(fatherAddress);
        const saleCratBalanceBefore = await token.balanceOf(sale.address);
        const userCratBalanceBefore = await token.balanceOf(userOne.address);
        const fatherInfoBefore = await sale.userInfo(fatherAddress);

        expect(fatherInfoBefore.referralReceived).to.equal(0);

        const stableAmount = await sale.calculateTokensAmount(tokensToBuy);
        const craftTotalTokensAmount = stableAmount.add(craftBonusTokensAmount);
        const bonusTokensAmount = await sale.calculateTokensAmount(craftBonusStablesAmount);
        const referralRefundAmount = tokensToBuy.mul(initInterest).div(maxInterest);
        const underlyingSaleAmount = tokensToBuy.sub(referralRefundAmount);

        expect(stableAmount).to.equal(craftStableAmount);
        expect(craftBonusTokensAmount).to.equal(bonusTokensAmount);
        expect(referralRefundAmount).to.equal(craftRefundAmount);

        await usdt.connect(userOne).approve(sale.address, tokensToBuy);
        await sale.connect(userOne).buyCratTokens(usdt.address, tokensToBuy, fatherAddress, await sale.calculateReferralRefundAmount(userOne.address, fatherAddress, tokensToBuy));

        const saleUsdtBalanceAfter = await usdt.balanceOf(sale.address);
        const userUsdtBalanceAfter = await usdt.balanceOf(userOne.address);
        const fatherUsdtBalanceAfter = await usdt.balanceOf(fatherAddress);
        const saleCratBalanceAfter = await token.balanceOf(sale.address);
        const userCratBalanceAfter = await token.balanceOf(userOne.address);
        const fatherInfoAfter = await sale.userInfo(fatherAddress);

        expect(fatherInfoAfter.referralReceived).to.equal(referralRefundAmount);

        expect(saleUsdtBalanceBefore.add(underlyingSaleAmount)).to.equal(saleUsdtBalanceAfter);
        expect(userUsdtBalanceBefore.sub(tokensToBuy)).to.equal(userUsdtBalanceAfter);
        expect(fatherUsdtBalanceBefore.add(referralRefundAmount)).to.equal(fatherUsdtBalanceAfter);
        expect(saleCratBalanceBefore.sub(craftTotalTokensAmount)).to.equal(saleCratBalanceAfter);
        expect(userCratBalanceBefore.add(craftTotalTokensAmount)).to.equal(userCratBalanceAfter);
    }

    describe("Deploy", function () {
        it("Should right supply after deploy", async function () {
            const { token, amountToMint } = await loadFixture(deployCrowdsaleFixture);

            expect(await token.totalSupply()).to.equal(amountToMint);
        });

        it("Should right sale balance after deploy", async function () {
            const { token, amountToMint, sale } = await loadFixture(deployCrowdsaleFixture);

            expect(await token.balanceOf(sale.address)).to.equal(amountToMint);
        });

        it("Should right totalFundsRaised after deploy", async function () {
            const { sale } = await loadFixture(deployCrowdsaleFixture);

            expect(await sale.totalFundsRaised()).to.equal(0);
        });

        it("Should right referralRefundInterest after deploy", async function () {
            const { sale } = await loadFixture(deployCrowdsaleFixture);

            const initialInterest = 1000;

            expect(await sale.referralRefundInterest()).to.equal(initialInterest);
        });

        it("Should right currentTokenPrice after deploy", async function () {
            const { sale } = await loadFixture(deployCrowdsaleFixture);

            const currentTokenPrice = withDecimals("0.2");

            expect(await sale.currentTokenPrice()).to.equal(currentTokenPrice);
        });

        it("Should not paused after deploy", async function () {
            const { sale } = await loadFixture(deployCrowdsaleFixture);

            expect(await sale.paused()).to.equal(false);
        });
    });

    describe("Buy", function () {
        it("Should revert by wrong stablecoin address", async function () {
            const { userOne, token, sale } = await loadFixture(deployCrowdsaleFixture);

            const tokensToBuy = withDecimals("100");

            await expect(sale.connect(userOne).buyCratTokens(token.address, tokensToBuy, userOne.address, 0)).to.be.revertedWith(
                "CratCrowdsale: invalid stablecoin"
            );
        });

        it("Should revert by 0 spend stablecoin amount", async function () {
            const { userOne, usdt, sale } = await loadFixture(deployCrowdsaleFixture);

            const stablesAmount = 0;

            await expect(sale.connect(userOne).buyCratTokens(usdt.address, stablesAmount, userOne.address, 0)).to.be.revertedWith(
                "CratCrowdsale: invalid amount"
            );
        });

        it("Should revert by balance exceeded crat tokens amount ", async function () {
            const { userOne, usdt, sale } = await loadFixture(deployCrowdsaleFixture);

            const tokensToBuy = withDecimals("10000001");;

            await expect(sale.connect(userOne).buyCratTokens(usdt.address, tokensToBuy, userOne.address, 0)).to.be.revertedWith(
                "ERC20: transfer amount exceeds balance"
            );
        });

        it("Should revert by balance exceeded spend stablecoin amount", async function () {
            const { userOne, usdt, sale, userBalance } = await loadFixture(deployCrowdsaleFixture);

            await usdt.connect(userOne).transfer(sale.address, userBalance);
            await usdt.connect(userOne).approve(sale.address, userBalance);
            const tokensToBuy = withDecimals("1");;

            await expect(sale.connect(userOne).buyCratTokens(usdt.address, tokensToBuy, userOne.address, 0)).to.be.revertedWith(
                "ERC20: transfer amount exceeds balance"
            );
        });

        it("Should revert by insufficient allowance", async function () {
            const { userOne, usdt, sale } = await loadFixture(deployCrowdsaleFixture);

            const tokensToBuy = withDecimals("1000");;

            await expect(sale.connect(userOne).buyCratTokens(usdt.address, tokensToBuy, userOne.address, 0)).to.be.revertedWith(
                "ERC20: insufficient allowance"
            );
        });

        it("Should right total balances", async function () {
            const { userOne, token, userTwo, admin, usdt, sale } = await loadFixture(deployCrowdsaleFixture);

            const zeroAddress = ethers.constants.AddressZero;
            const userInfoBefore = await sale.userInfo(userOne.address);
            const fatherInfoBefore = await sale.userInfo(userTwo.address);
            const totalRaisedBefore = await sale.totalFundsRaised();
            const initPrice = await sale.currentTokenPrice();
            const initInterestRate = await sale.referralRefundInterest();

            expect(totalRaisedBefore).to.equal(0);
            expect(initPrice).to.equal(withDecimals("0.2"));
            expect(initInterestRate).to.equal(1000);
            expect(userInfoBefore.bonusTokensReceived).to.equal(0);
            expect(userInfoBefore.referralReceived).to.equal(0);
            expect(userInfoBefore.totalSpend).to.equal(0);
            expect(userInfoBefore.referralFather).to.equal(zeroAddress);
            expect(fatherInfoBefore.bonusTokensReceived).to.equal(0);
            expect(fatherInfoBefore.referralReceived).to.equal(0);
            expect(fatherInfoBefore.totalSpend).to.equal(0);
            expect(fatherInfoBefore.referralFather).to.equal(zeroAddress);

            const stablesToPay = withDecimals("400");
            const tokensAmount = await sale.calculateTokensAmount(stablesToPay);
            const craftTokensAmount = withDecimals("2000");

            expect(tokensAmount).to.equal(craftTokensAmount);

            await usdt.connect(userOne).approve(sale.address, stablesToPay);
            await sale.connect(userOne).buyCratTokens(usdt.address, stablesToPay, zeroAddress, await sale.calculateReferralRefundAmount(userOne.address, zeroAddress, stablesToPay));

            const stablesToPayTwo = withDecimals("4500");
            const tokensAmountTwo = await sale.calculateTokensAmount(stablesToPayTwo);
            const craftTokensAmountTwo = withDecimals("22500");

            expect(craftTokensAmountTwo).to.equal(tokensAmountTwo);

            await usdt.connect(userTwo).approve(sale.address, stablesToPayTwo);
            await sale.connect(userTwo).buyCratTokens(usdt.address, stablesToPayTwo, zeroAddress, await sale.calculateReferralRefundAmount(userTwo.address, zeroAddress, stablesToPayTwo));

            const stablesToPayThree = withDecimals("100000");

            await usdt.connect(userOne).approve(sale.address, stablesToPayThree);
            await sale.connect(userOne).buyCratTokens(usdt.address, stablesToPayThree, userTwo.address, await sale.calculateReferralRefundAmount(userOne.address, userTwo.address, stablesToPayThree));

            await sale.connect(admin).pause();
            await sale.connect(admin).changeRefundInterest(3500);
            await sale.connect(admin).unpause();

            const stablesToPayFour = withDecimals("123000");

            await usdt.connect(userTwo).approve(sale.address, stablesToPayFour);
            await sale.connect(userTwo).buyCratTokens(usdt.address, stablesToPayFour, userOne.address, await sale.calculateReferralRefundAmount(userTwo.address, userOne.address, stablesToPayFour));

            await sale.connect(admin).pause();
            await sale.connect(admin).changeRefundInterest(1234);
            await sale.connect(admin).unpause();

            const stablesToPayFive = withDecimals("12300");

            await usdt.connect(userTwo).approve(sale.address, stablesToPayFive);
            await sale.connect(userTwo).buyCratTokens(usdt.address, stablesToPayFive, admin.address, await sale.calculateReferralRefundAmount(userTwo.address, admin.address, stablesToPayFive));

            const stablesToPaySix = withDecimals("100000");

            await usdt.connect(userOne).approve(sale.address, stablesToPaySix);
            await sale.connect(userOne).buyCratTokens(usdt.address, stablesToPaySix, userOne.address, await sale.calculateReferralRefundAmount(userOne.address, userOne.address, stablesToPaySix));

            await sale.connect(admin).withdrawTokens(token.address, admin.address, stablesToPayFive);
            await sale.connect(admin).withdrawTokens(token.address, userTwo.address, stablesToPayFive);
            await sale.connect(admin).withdrawTokens(usdt.address, admin.address, stablesToPayFive);

            const stablesToPaySeven = withDecimals("12399");

            await usdt.connect(userTwo).approve(sale.address, stablesToPaySeven);
            await sale.connect(userTwo).buyCratTokens(usdt.address, stablesToPaySeven, sale.address, await sale.calculateReferralRefundAmount(userTwo.address, sale.address, stablesToPaySeven));

            const stablesToPayEight = withDecimals("12399");

            await usdt.connect(userTwo).approve(sale.address, stablesToPayEight);
            await sale.connect(userTwo).buyCratTokens(usdt.address, stablesToPayEight, zeroAddress, await sale.calculateReferralRefundAmount(userTwo.address, zeroAddress, stablesToPayEight));

            await sale.connect(admin).pause();
            await sale.connect(admin).changeRefundInterest(0);
            await sale.connect(admin).unpause();

            const stablesToPayNine = withDecimals("99000");

            await usdt.connect(userTwo).approve(sale.address, stablesToPayNine);
            await sale.connect(userTwo).buyCratTokens(usdt.address, stablesToPayNine, userOne.address, await sale.calculateReferralRefundAmount(userTwo.address, userOne.address, stablesToPayNine));

            await sale.connect(admin).withdrawTokens(token.address, admin.address, stablesToPayTwo);
            await sale.connect(admin).withdrawTokens(token.address, userOne.address, stablesToPayTwo);
            await sale.connect(admin).withdrawTokens(usdt.address, userOne.address, stablesToPayTwo);

            const stablesToPayTen = withDecimals("12300");

            await usdt.connect(admin).approve(sale.address, stablesToPayTen);
            await sale.connect(admin).buyCratTokens(usdt.address, stablesToPayTen, userOne.address, await sale.calculateReferralRefundAmount(admin.address, userOne.address, stablesToPayTen));

            const saleUsdtBalanceAfter = await usdt.balanceOf(sale.address);
            const userUsdtBalanceAfter = await usdt.balanceOf(userOne.address);
            const fatherUsdtBalanceAfter = await usdt.balanceOf(userTwo.address);
            const adminUsdtBalanceAfter = await usdt.balanceOf(admin.address);
            const saleCratBalanceAfter = await token.balanceOf(sale.address);
            const userCratBalanceAfter = await token.balanceOf(userOne.address);
            const fatherCratBalanceAfter = await token.balanceOf(userTwo.address);
            const adminCratBalanceAfter = await token.balanceOf(admin.address);
            const userInfoAfter = await sale.userInfo(userOne.address);
            const fatherInfoAfter = await sale.userInfo(userTwo.address);
            const totalRaisedAfter = await sale.totalFundsRaised();
            const priceAfter = await sale.currentTokenPrice();
            const interestRateAfter = await sale.referralRefundInterest();

            expect(saleUsdtBalanceAfter).to.equal(withDecimals("389530.1068"));
            expect(userUsdtBalanceAfter).to.equal(withDecimals("9851727.8932"));
            expect(adminUsdtBalanceAfter).to.equal(withDecimals("0"));
            expect(totalRaisedAfter).to.equal(withDecimals("476298"));
            expect(priceAfter).to.equal(withDecimals("0.25"));
            expect(interestRateAfter).to.equal(withDecimals("0"));
            expect(userInfoAfter.bonusTokensReceived).to.equal(withDecimals("25000"));
            expect(userInfoAfter.referralReceived).to.equal(withDecimals("47627.8932"));
            expect(userInfoAfter.totalSpend).to.equal(withDecimals("200400"));
            expect(userInfoAfter.referralFather).to.equal(userTwo.address);
            expect(fatherInfoAfter.bonusTokensReceived).to.equal(withDecimals("20954.545454545454545454"));
            expect(fatherInfoAfter.referralReceived).to.equal(withDecimals("22340"));
            expect(fatherInfoAfter.totalSpend).to.equal(withDecimals("263598"));
            expect(fatherInfoAfter.referralFather).to.equal(userOne.address);

            const totalUsdt = saleUsdtBalanceAfter.add(userUsdtBalanceAfter).add(fatherUsdtBalanceAfter).add(adminUsdtBalanceAfter);
            expect(totalUsdt).to.equal(withDecimals("20000000"));

            const totalCrat = saleCratBalanceAfter.add(userCratBalanceAfter).add(fatherCratBalanceAfter).add(adminCratBalanceAfter);
            expect(totalCrat).to.equal(withDecimals("20000000"));
        });

        describe("Instant tier bonus, no referral, init price", function () {
            it("Should right balances after buy without bonus", async function () {
                const stablesToPay = withDecimals("200");
                const craftTokensAmount = withDecimals("1000");
                const craftBonusStablesAmount = withDecimals("0");
                const craftBonusTokensAmount = withDecimals("0");

                await oneBuyInstantBonus(stablesToPay, craftTokensAmount, craftBonusStablesAmount, craftBonusTokensAmount);
            });

            it("Should right balances after buy with first instant tier bonus", async function () {
                const stablesToPay = withDecimals("500");
                const craftTokensAmount = withDecimals("2500");
                const craftBonusStablesAmount = withDecimals("10");
                const craftBonusTokensAmount = withDecimals("50");

                await oneBuyInstantBonus(stablesToPay, craftTokensAmount, craftBonusStablesAmount, craftBonusTokensAmount);
            });

            it("Should right balances after buy with second instant tier bonus", async function () {
                const stablesToPay = withDecimals("1000");
                const craftTokensAmount = withDecimals("5000");
                const craftBonusStablesAmount = withDecimals("30");
                const craftBonusTokensAmount = withDecimals("150");

                await oneBuyInstantBonus(stablesToPay, craftTokensAmount, craftBonusStablesAmount, craftBonusTokensAmount);
            });

            it("Should right balances after buy with third instant tier bonus", async function () {
                const stablesToPay = withDecimals("2000");
                const craftTokensAmount = withDecimals("10000");
                const craftBonusStablesAmount = withDecimals("100");
                const craftBonusTokensAmount = withDecimals("500");

                await oneBuyInstantBonus(stablesToPay, craftTokensAmount, craftBonusStablesAmount, craftBonusTokensAmount);
            });

            it("Should right balances after buy with fourth instant tier bonus", async function () {
                const stablesToPay = withDecimals("5000");
                const craftTokensAmount = withDecimals("25000");
                const craftBonusStablesAmount = withDecimals("500");
                const craftBonusTokensAmount = withDecimals("2500");

                await oneBuyInstantBonus(stablesToPay, craftTokensAmount, craftBonusStablesAmount, craftBonusTokensAmount);
            });

            it("Should right balances after buy with fifth instant tier bonus", async function () {
                const stablesToPay = withDecimals("10000");
                const craftTokensAmount = withDecimals("50000");
                const craftBonusStablesAmount = withDecimals("1500");
                const craftBonusTokensAmount = withDecimals("7500");

                await oneBuyInstantBonus(stablesToPay, craftTokensAmount, craftBonusStablesAmount, craftBonusTokensAmount);
            });

            it("Should right balances after buy with sixth instant tier bonus", async function () {
                const { token, sale, usdc, usdt, userOne } = await loadFixture(deployCrowdsaleFixture);

                const saleUsdtBalanceBefore = await usdt.balanceOf(sale.address);
                const userUsdtBalanceBefore = await usdt.balanceOf(userOne.address);
                const saleCratBalanceBefore = await token.balanceOf(sale.address);
                const userCratBalanceBefore = await token.balanceOf(userOne.address);

                const stablesToPay = withDecimals("20000");
                const craftTokensAmount = withDecimals("100000");
                const craftBonusStablesAmount = withDecimals("5000");
                const craftBonusTokensAmount = withDecimals("25000");
                const tokensAmount = await sale.calculateTokensAmount(stablesToPay);
                const craftTotalTokensAmount = tokensAmount.add(craftBonusTokensAmount);
                const bonusTokensAmount = await sale.calculateTokensAmount(craftBonusStablesAmount)

                expect(tokensAmount).to.equal(craftTokensAmount);
                expect(craftBonusTokensAmount).to.equal(bonusTokensAmount);

                await usdt.connect(userOne).approve(sale.address, stablesToPay);
                await sale.connect(userOne).buyCratTokens(usdt.address, stablesToPay, userOne.address, await sale.calculateReferralRefundAmount(userOne.address, userOne.address, stablesToPay));

                const saleUsdtBalanceAfter = await usdt.balanceOf(sale.address);
                const userUsdtBalanceAfter = await usdt.balanceOf(userOne.address);
                const saleCratBalanceAfter = await token.balanceOf(sale.address);
                const userCratBalanceAfter = await token.balanceOf(userOne.address);

                expect(saleUsdtBalanceBefore.add(stablesToPay)).to.equal(saleUsdtBalanceAfter);
                expect(userUsdtBalanceBefore.sub(stablesToPay)).to.equal(userUsdtBalanceAfter);
                expect(saleCratBalanceBefore.sub(craftTotalTokensAmount)).to.equal(saleCratBalanceAfter);
                expect(userCratBalanceBefore.add(craftTotalTokensAmount)).to.equal(userCratBalanceAfter);

                const saleUsdcBalanceBefore = await usdc.balanceOf(sale.address);
                const userUsdcBalanceBefore = await usdc.balanceOf(userOne.address);

                const stablesToPayTwo = withDecimals("20000");
                const craftTokensAmountTwo = withDecimals("100000");
                const tokensAmountTwo = await sale.calculateTokensAmount(stablesToPayTwo);
                const craftTotalTokensAmountTwo = tokensAmountTwo;

                expect(tokensAmountTwo).to.equal(craftTokensAmountTwo);
                expect(craftTotalTokensAmountTwo).to.equal(tokensAmountTwo);

                await usdc.connect(userOne).approve(sale.address, stablesToPayTwo);
                await sale.connect(userOne).buyCratTokens(usdc.address, stablesToPayTwo, userOne.address, await sale.calculateReferralRefundAmount(userOne.address, userOne.address, stablesToPayTwo));

                const saleUsdcBalanceAfter = await usdc.balanceOf(sale.address);
                const userUsdcBalanceAfter = await usdc.balanceOf(userOne.address);
                const saleCratBalanceAfterTwo = await token.balanceOf(sale.address);
                const userCratBalanceAfterTwo = await token.balanceOf(userOne.address);

                expect(saleUsdcBalanceBefore.add(stablesToPayTwo)).to.equal(saleUsdcBalanceAfter);
                expect(userUsdcBalanceBefore.sub(stablesToPayTwo)).to.equal(userUsdcBalanceAfter);
                expect(saleCratBalanceAfter.sub(tokensAmountTwo)).to.equal(saleCratBalanceAfterTwo);
                expect(userCratBalanceAfter.add(tokensAmountTwo)).to.equal(userCratBalanceAfterTwo);
            });
        });

        describe("Cumulative tier bonus, no referral, init price", function () {
            it("Should right balances after second buy after first instant tier bonus", async function () {
                const stablesToPay = withDecimals("500");
                const craftTokensAmount = withDecimals("2500");
                const craftBonusStablesAmount = withDecimals("10");
                const craftBonusTokensAmount = withDecimals("50");
                const stablesToPayTwo = withDecimals("300");
                const craftTokensAmountTwo = withDecimals("1500");
                const craftBonusStablesAmountTwo = withDecimals("0");
                const craftBonusTokensAmountTwo = withDecimals("0");

                await doubleBuyWithDoubleBonus(stablesToPay, craftTokensAmount, craftBonusStablesAmount, craftBonusTokensAmount,
                    stablesToPayTwo, craftTokensAmountTwo, craftBonusStablesAmountTwo, craftBonusTokensAmountTwo);
            });

            it("Should right balances after second buy after second instant tier bonus", async function () {
                const stablesToPay = withDecimals("1000");
                const craftTokensAmount = withDecimals("5000");
                const craftBonusStablesAmount = withDecimals("30");
                const craftBonusTokensAmount = withDecimals("150");
                const stablesToPayTwo = withDecimals("700");
                const craftTokensAmountTwo = withDecimals("3500");
                const craftBonusStablesAmountTwo = withDecimals("0");
                const craftBonusTokensAmountTwo = withDecimals("0");

                await doubleBuyWithDoubleBonus(stablesToPay, craftTokensAmount, craftBonusStablesAmount, craftBonusTokensAmount,
                    stablesToPayTwo, craftTokensAmountTwo, craftBonusStablesAmountTwo, craftBonusTokensAmountTwo);

            });

            it("Should right balances after second buy after third instant tier bonus", async function () {
                const stablesToPay = withDecimals("2000");
                const craftTokensAmount = withDecimals("10000");
                const craftBonusStablesAmount = withDecimals("100");
                const craftBonusTokensAmount = withDecimals("500");
                const stablesToPayTwo = withDecimals("2500");
                const craftTokensAmountTwo = withDecimals("12500");
                const craftBonusStablesAmountTwo = withDecimals("0");
                const craftBonusTokensAmountTwo = withDecimals("0");

                await doubleBuyWithDoubleBonus(stablesToPay, craftTokensAmount, craftBonusStablesAmount, craftBonusTokensAmount,
                    stablesToPayTwo, craftTokensAmountTwo, craftBonusStablesAmountTwo, craftBonusTokensAmountTwo);
            });

            it("Should right balances after second buy after fourth instant tier bonus", async function () {
                const stablesToPay = withDecimals("5000");
                const craftTokensAmount = withDecimals("25000");
                const craftBonusStablesAmount = withDecimals("500");
                const craftBonusTokensAmount = withDecimals("2500");
                const stablesToPayTwo = withDecimals("4500");
                const craftTokensAmountTwo = withDecimals("22500");
                const craftBonusStablesAmountTwo = withDecimals("0");
                const craftBonusTokensAmountTwo = withDecimals("0");

                await doubleBuyWithDoubleBonus(stablesToPay, craftTokensAmount, craftBonusStablesAmount, craftBonusTokensAmount,
                    stablesToPayTwo, craftTokensAmountTwo, craftBonusStablesAmountTwo, craftBonusTokensAmountTwo);
            });

            it("Should right balances after second buy after fifth instant tier bonus", async function () {
                const stablesToPay = withDecimals("10000");
                const craftTokensAmount = withDecimals("50000");
                const craftBonusStablesAmount = withDecimals("1500");
                const craftBonusTokensAmount = withDecimals("7500");
                const stablesToPayTwo = withDecimals("2000");
                const craftTokensAmountTwo = withDecimals("10000");
                const craftBonusStablesAmountTwo = withDecimals("0");
                const craftBonusTokensAmountTwo = withDecimals("0");

                await doubleBuyWithDoubleBonus(stablesToPay, craftTokensAmount, craftBonusStablesAmount, craftBonusTokensAmount,
                    stablesToPayTwo, craftTokensAmountTwo, craftBonusStablesAmountTwo, craftBonusTokensAmountTwo);
            });

            it("Should right balances after second buy after sixth instant tier bonus", async function () {
                const stablesToPay = withDecimals("20000");
                const craftTokensAmount = withDecimals("100000");
                const craftBonusStablesAmount = withDecimals("5000");
                const craftBonusTokensAmount = withDecimals("25000");
                const stablesToPayTwo = withDecimals("3000");
                const craftTokensAmountTwo = withDecimals("15000");
                const craftBonusStablesAmountTwo = withDecimals("0");
                const craftBonusTokensAmountTwo = withDecimals("0");

                await doubleBuyWithDoubleBonus(stablesToPay, craftTokensAmount, craftBonusStablesAmount, craftBonusTokensAmount,
                    stablesToPayTwo, craftTokensAmountTwo, craftBonusStablesAmountTwo, craftBonusTokensAmountTwo);
            });

            it("Should right balance after every payment new tier achieved", async function () {
                const { sale, usdt, userOne, userTwo, userBalance } = await loadFixture(deployCrowdsaleFixture);

                await usdt.connect(userOne).approve(sale.address, userBalance);

                const zeroAddress = ethers.constants.AddressZero;
                const amountToBuyZero = withDecimals("250");
                const amountToBuyOne = withDecimals("500");
                const amountToBuyTwo = withDecimals("500");
                const amountToBuyThree = withDecimals("1000");
                const amountToBuyFour = withDecimals("3000");
                const amountToBuyFive = withDecimals("5000");
                const amountToBuySix = withDecimals("10000");

                await sale.connect(userOne).buyCratTokens(usdt.address, amountToBuyZero, userOne.address, await sale.calculateReferralRefundAmount(userOne.address, userOne.address, amountToBuyZero));
                await sale.connect(userOne).buyCratTokens(usdt.address, amountToBuyOne, zeroAddress, await sale.calculateReferralRefundAmount(userOne.address, zeroAddress, amountToBuyOne));
                await sale.connect(userOne).buyCratTokens(usdt.address, amountToBuyTwo, userOne.address, await sale.calculateReferralRefundAmount(userOne.address, userOne.address, amountToBuyTwo));
                await sale.connect(userOne).buyCratTokens(usdt.address, amountToBuyThree, userTwo.address, await sale.calculateReferralRefundAmount(userOne.address, userTwo.address, amountToBuyThree));
                await sale.connect(userOne).buyCratTokens(usdt.address, amountToBuyFour, userTwo.address, await sale.calculateReferralRefundAmount(userOne.address, userTwo.address, amountToBuyFour));
                await sale.connect(userOne).buyCratTokens(usdt.address, amountToBuyFive, zeroAddress, await sale.calculateReferralRefundAmount(userOne.address, zeroAddress, amountToBuyFive));
                await sale.connect(userOne).buyCratTokens(usdt.address, amountToBuySix, userOne.address, await sale.calculateReferralRefundAmount(userOne.address, userOne.address, amountToBuySix));

                const totalSaleUsdtBalance = amountToBuyZero.add(amountToBuyOne).add(amountToBuyTwo).add(amountToBuyThree).
                    add(amountToBuyFour).add(amountToBuyFive).add(amountToBuySix);
                const userInfo = await sale.userInfo(userOne.address);
                expect(userInfo.referralFather).to.equal(userTwo.address);
                expect(totalSaleUsdtBalance).to.equal(withDecimals("20250"));
            });

            describe("Double cumulative bonus", function () {
                it("Should right balances after second bonus buy after first instant tier bonus", async function () {
                    const stablesToPay = withDecimals("500");
                    const craftTokensAmount = withDecimals("2500");
                    const craftBonusStablesAmount = withDecimals("10");
                    const craftBonusTokensAmount = withDecimals("50");
                    const stablesToPayTwo = withDecimals("1200");
                    const craftTokensAmountTwo = withDecimals("6000");
                    const craftBonusStablesAmountTwo = withDecimals("15");
                    const craftBonusTokensAmountTwo = withDecimals("75");

                    await doubleBuyWithDoubleBonus(stablesToPay, craftTokensAmount, craftBonusStablesAmount, craftBonusTokensAmount,
                        stablesToPayTwo, craftTokensAmountTwo, craftBonusStablesAmountTwo, craftBonusTokensAmountTwo);
                });

                it("Should right balances after second bonus buy after second instant tier bonus", async function () {
                    const stablesToPay = withDecimals("1300");
                    const craftTokensAmount = withDecimals("6500");
                    const craftBonusStablesAmount = withDecimals("30");
                    const craftBonusTokensAmount = withDecimals("150");
                    const stablesToPayTwo = withDecimals("3700");
                    const craftTokensAmountTwo = withDecimals("18500");
                    const craftBonusStablesAmountTwo = withDecimals("400");
                    const craftBonusTokensAmountTwo = withDecimals("2000");

                    await doubleBuyWithDoubleBonus(stablesToPay, craftTokensAmount, craftBonusStablesAmount, craftBonusTokensAmount,
                        stablesToPayTwo, craftTokensAmountTwo, craftBonusStablesAmountTwo, craftBonusTokensAmountTwo);
                });

                it("Should right balances after second bonus buy after third instant tier bonus", async function () {
                    const stablesToPay = withDecimals("2000");
                    const craftTokensAmount = withDecimals("10000");
                    const craftBonusStablesAmount = withDecimals("100");
                    const craftBonusTokensAmount = withDecimals("500");
                    const stablesToPayTwo = withDecimals("8500");
                    const craftTokensAmountTwo = withDecimals("42500");
                    const craftBonusStablesAmountTwo = withDecimals("1200");
                    const craftBonusTokensAmountTwo = withDecimals("6000");

                    await doubleBuyWithDoubleBonus(stablesToPay, craftTokensAmount, craftBonusStablesAmount, craftBonusTokensAmount,
                        stablesToPayTwo, craftTokensAmountTwo, craftBonusStablesAmountTwo, craftBonusTokensAmountTwo);
                });

                it("Should right balances after second bonus buy after fourth instant tier bonus", async function () {
                    const stablesToPay = withDecimals("5000");
                    const craftTokensAmount = withDecimals("25000");
                    const craftBonusStablesAmount = withDecimals("500");
                    const craftBonusTokensAmount = withDecimals("2500");
                    const stablesToPayTwo = withDecimals("10000");
                    const craftTokensAmountTwo = withDecimals("50000");
                    const craftBonusStablesAmountTwo = withDecimals("750");
                    const craftBonusTokensAmountTwo = withDecimals("3750");


                    await doubleBuyWithDoubleBonus(stablesToPay, craftTokensAmount, craftBonusStablesAmount, craftBonusTokensAmount,
                        stablesToPayTwo, craftTokensAmountTwo, craftBonusStablesAmountTwo, craftBonusTokensAmountTwo);
                });

                it("Should right balances after second bonus buy after fifth instant tier bonus", async function () {
                    const stablesToPay = withDecimals("5000");
                    const craftTokensAmount = withDecimals("25000");
                    const craftBonusStablesAmount = withDecimals("500");
                    const craftBonusTokensAmount = withDecimals("2500");
                    const stablesToPayTwo = withDecimals("17000");
                    const craftTokensAmountTwo = withDecimals("85000");
                    const craftBonusStablesAmountTwo = withDecimals("3750");
                    const craftBonusTokensAmountTwo = withDecimals("18750");


                    await doubleBuyWithDoubleBonus(stablesToPay, craftTokensAmount, craftBonusStablesAmount, craftBonusTokensAmount,
                        stablesToPayTwo, craftTokensAmountTwo, craftBonusStablesAmountTwo, craftBonusTokensAmountTwo);
                });


                it("Should right balances after second bonus buy after zero instant tier bonus", async function () {
                    const stablesToPay = withDecimals("250");
                    const craftTokensAmount = withDecimals("1250");
                    const craftBonusStablesAmount = withDecimals("0");
                    const craftBonusTokensAmount = withDecimals("0");
                    const stablesToPayTwo = withDecimals("9750");
                    const craftTokensAmountTwo = withDecimals("48750");
                    const craftBonusStablesAmountTwo = withDecimals("1500");
                    const craftBonusTokensAmountTwo = withDecimals("7500");

                    await doubleBuyWithDoubleBonus(stablesToPay, craftTokensAmount, craftBonusStablesAmount, craftBonusTokensAmount,
                        stablesToPayTwo, craftTokensAmountTwo, craftBonusStablesAmountTwo, craftBonusTokensAmountTwo);
                });
            });
        });

        describe("Referral refund", function () {
            it("Should correctly calculate referral refund", async function () {
                const { token, sale, usdt, userOne, userTwo } = await loadFixture(deployCrowdsaleFixture);

                const tokensToBuy = withDecimals("400");
                const refundAmount = withDecimals("40");
                const zeroAddress = ethers.constants.AddressZero;

                expect(await sale.calculateReferralRefundAmount(userOne.address, userOne.address, tokensToBuy)).equal(0);
                expect(await sale.calculateReferralRefundAmount(userOne.address, zeroAddress, tokensToBuy)).equal(0);
                expect(await sale.calculateReferralRefundAmount(userOne.address, userTwo.address, tokensToBuy)).equal(refundAmount);

                await usdt.connect(userOne).approve(sale.address, tokensToBuy);
                await sale.connect(userOne).buyCratTokens(usdt.address, tokensToBuy, userTwo.address, 0);

                expect(await sale.calculateReferralRefundAmount(userOne.address, userOne.address, tokensToBuy)).equal(refundAmount);
                expect(await sale.calculateReferralRefundAmount(userOne.address, zeroAddress, tokensToBuy)).equal(refundAmount);
                expect(await sale.calculateReferralRefundAmount(userOne.address, userTwo.address, tokensToBuy)).equal(refundAmount);
            });

            it("Should revert if minRefundAMount is not met", async function () {
                const { token, sale, usdt, userOne, userTwo } = await loadFixture(deployCrowdsaleFixture);

                const tokensToBuy = withDecimals("400");
                const refundAmount = withDecimals("40");

                await usdt.connect(userOne).approve(sale.address, tokensToBuy);
                await expect(sale.connect(userOne).buyCratTokens(usdt.address, tokensToBuy, userTwo.address, refundAmount + 1)).revertedWith("CratCrowdsale: minRefundAmount not met");
                await expect(sale.connect(userOne).buyCratTokens(usdt.address, tokensToBuy, userOne.address, 1)).revertedWith("CratCrowdsale: minRefundAmount not met");
            });
            
            it("Should right balances correct new father address buy 2000 tokens", async function () {
                const { token, sale, usdt, userOne, userTwo } = await loadFixture(deployCrowdsaleFixture);

                const tokensToBuy = withDecimals("400");
                const craftStableAmount = withDecimals("2000");
                const craftBonusStablesAmount = withDecimals("0");
                const craftBonusTokensAmount = withDecimals("0");
                const craftRefundAmount = withDecimals("40");
                const fatherAddress = userTwo.address;

                await oneBuyReferral(tokensToBuy, craftStableAmount, craftBonusStablesAmount, craftBonusTokensAmount,
                    token, sale, usdt, userOne, userTwo, fatherAddress, craftRefundAmount);
            });

            it("Should right balances correct new father address buy 50000 tokens", async function () {
                const { token, sale, usdt, userOne, userTwo } = await loadFixture(deployCrowdsaleFixture);

                const tokensToBuy = withDecimals("10000");
                const craftStableAmount = withDecimals("50000");
                const craftBonusStablesAmount = withDecimals("1500");
                const craftBonusTokensAmount = withDecimals("7500");
                const craftRefundAmount = withDecimals("1000");
                const fatherAddress = userTwo.address;

                await oneBuyReferral(tokensToBuy, craftStableAmount, craftBonusStablesAmount, craftBonusTokensAmount,
                    token, sale, usdt, userOne, userTwo, fatherAddress, craftRefundAmount);
            });

            it("Should right balances correct new father address buy 100000 tokens", async function () {
                const { token, sale, usdc, userOne, userTwo } = await loadFixture(deployCrowdsaleFixture);

                const tokensToBuy = withDecimals("20000");
                const craftStableAmount = withDecimals("100000");
                const craftBonusStablesAmount = withDecimals("5000");
                const craftBonusTokensAmount = withDecimals("25000");
                const craftRefundAmount = withDecimals("2000");
                const fatherAddress = userTwo.address;
                const usdt = usdc;

                await oneBuyReferral(tokensToBuy, craftStableAmount, craftBonusStablesAmount, craftBonusTokensAmount,
                    token, sale, usdt, userOne, userTwo, fatherAddress, craftRefundAmount);
            });

            it("Should right balances father zero address", async function () {
                const { token, sale, usdt, userOne } = await loadFixture(deployCrowdsaleFixture);

                const zeroAddress = ethers.constants.AddressZero;
                const fatherAddressBefore = await sale.userInfo(userOne.address);
                expect(fatherAddressBefore.referralFather).to.equal(zeroAddress);

                const saleUsdtBalanceBefore = await usdt.balanceOf(sale.address);
                const userUsdtBalanceBefore = await usdt.balanceOf(userOne.address);
                const saleCratBalanceBefore = await token.balanceOf(sale.address);
                const userCratBalanceBefore = await token.balanceOf(userOne.address);

                const tokensToBuy = withDecimals("2000");
                const craftStableAmount = withDecimals("10000");
                const craftBonusStablesAmount = withDecimals("100");
                const craftBonusTokensAmount = withDecimals("500");
                const stableAmount = await sale.calculateTokensAmount(tokensToBuy);
                const craftTotalTokensAmount = craftStableAmount.add(craftBonusTokensAmount);
                const bonusTokensAmount = await sale.calculateTokensAmount(craftBonusStablesAmount);

                expect(stableAmount).to.equal(craftStableAmount);
                expect(craftBonusTokensAmount).to.equal(bonusTokensAmount);

                await usdt.connect(userOne).approve(sale.address, tokensToBuy);
                await sale.connect(userOne).buyCratTokens(usdt.address, tokensToBuy, zeroAddress, await sale.calculateReferralRefundAmount(userOne.address, zeroAddress, tokensToBuy));

                const saleUsdtBalanceAfter = await usdt.balanceOf(sale.address);
                const userUsdtBalanceAfter = await usdt.balanceOf(userOne.address);
                const saleCratBalanceAfter = await token.balanceOf(sale.address);
                const userCratBalanceAfter = await token.balanceOf(userOne.address);

                const fatherAddressAfter = await sale.userInfo(userOne.address);
                expect(fatherAddressAfter.referralFather).to.equal(zeroAddress);

                expect(saleUsdtBalanceBefore.add(tokensToBuy)).to.equal(saleUsdtBalanceAfter);
                expect(userUsdtBalanceBefore.sub(tokensToBuy)).to.equal(userUsdtBalanceAfter);
                expect(saleCratBalanceBefore.sub(craftTotalTokensAmount)).to.equal(saleCratBalanceAfter);
                expect(userCratBalanceBefore.add(craftTotalTokensAmount)).to.equal(userCratBalanceAfter);
            });

            it("Should right balances father self address", async function () {
                const { token, sale, usdt, userOne } = await loadFixture(deployCrowdsaleFixture);

                const zeroAddress = ethers.constants.AddressZero;
                const fatherAddressBefore = await sale.userInfo(userOne.address);
                expect(fatherAddressBefore.referralFather).to.equal(zeroAddress);

                const saleUsdtBalanceBefore = await usdt.balanceOf(sale.address);
                const userUsdtBalanceBefore = await usdt.balanceOf(userOne.address);
                const saleCratBalanceBefore = await token.balanceOf(sale.address);
                const userCratBalanceBefore = await token.balanceOf(userOne.address);

                const stablesToPay = withDecimals("2000");
                const craftTokensAmount = withDecimals("10000");
                const craftBonusStablesAmount = withDecimals("100");
                const craftBonusTokensAmount = withDecimals("500");
                const tokensAmount = await sale.calculateTokensAmount(stablesToPay);
                const craftTotalTokensAmount = craftTokensAmount.add(craftBonusTokensAmount);
                const bonusTokensAmount = await sale.calculateTokensAmount(craftBonusStablesAmount);

                expect(craftTokensAmount).to.equal(tokensAmount);
                expect(craftBonusTokensAmount).to.equal(bonusTokensAmount);

                await usdt.connect(userOne).approve(sale.address, stablesToPay);
                await sale.connect(userOne).buyCratTokens(usdt.address, stablesToPay, userOne.address, await sale.calculateReferralRefundAmount(userOne.address, userOne.address, stablesToPay));

                const saleUsdtBalanceAfter = await usdt.balanceOf(sale.address);
                const userUsdtBalanceAfter = await usdt.balanceOf(userOne.address);
                const saleCratBalanceAfter = await token.balanceOf(sale.address);
                const userCratBalanceAfter = await token.balanceOf(userOne.address);

                const fatherAddressAfter = await sale.userInfo(userOne.address);
                expect(fatherAddressAfter.referralFather).to.equal(zeroAddress);

                expect(saleUsdtBalanceBefore.add(stablesToPay)).to.equal(saleUsdtBalanceAfter);
                expect(userUsdtBalanceBefore.sub(stablesToPay)).to.equal(userUsdtBalanceAfter);
                expect(saleCratBalanceBefore.sub(craftTotalTokensAmount)).to.equal(saleCratBalanceAfter);
                expect(userCratBalanceBefore.add(craftTotalTokensAmount)).to.equal(userCratBalanceAfter);
            });

            it("Should set father even with zero spend amount", async function () {
                const { token, sale, usdt, userOne, userTwo } = await loadFixture(deployCrowdsaleFixture);

                const zeroAddress = ethers.constants.AddressZero;
                const fatherAddressBefore = await sale.userInfo(userOne.address);
                expect(fatherAddressBefore.referralFather).to.equal(zeroAddress);

                const stableAmountOne = withDecimals("100");

                await usdt.connect(userOne).approve(sale.address, stableAmountOne);
                await sale.connect(userOne).buyCratTokens(usdt.address, stableAmountOne, userTwo.address, await sale.calculateReferralRefundAmount(userOne.address, userTwo.address, stableAmountOne));

                const fatherAddressAfter = await sale.userInfo(userOne.address);
                expect(fatherAddressAfter.referralFather).to.equal(userTwo.address);

                const saleUsdtBalanceBefore = await usdt.balanceOf(sale.address);
                const userUsdtBalanceBefore = await usdt.balanceOf(userOne.address);
                const fatherUsdtBalanceBefore = await usdt.balanceOf(userTwo.address);
                const saleCratBalanceBefore = await token.balanceOf(sale.address);
                const userCratBalanceBefore = await token.balanceOf(userOne.address);

                const tokensToBuy = withDecimals("2000");
                const craftStableAmount = withDecimals("400");
                const craftRefundAmount = withDecimals("40");
                const craftBonusStablesAmount = withDecimals("10");
                const craftBonusTokensAmount = withDecimals("50");
                const stableAmount = await sale.calculateStableAmount(tokensToBuy);
                const craftTotalTokensAmount = tokensToBuy.add(craftBonusTokensAmount);
                const bonusTokensAmount = await sale.calculateTokensAmount(craftBonusStablesAmount);
                const underlyingSaleAmount = stableAmount.sub(craftRefundAmount);

                expect(stableAmount).to.equal(craftStableAmount);
                expect(craftBonusTokensAmount).to.equal(bonusTokensAmount);

                await usdt.connect(userOne).approve(sale.address, stableAmount);
                await sale.connect(userOne).buyCratTokens(usdt.address, stableAmount, zeroAddress, await sale.calculateReferralRefundAmount(userOne.address, zeroAddress, stableAmount));

                const saleUsdtBalanceAfter = await usdt.balanceOf(sale.address);
                const userUsdtBalanceAfter = await usdt.balanceOf(userOne.address);
                const fatherUsdtBalanceAfter = await usdt.balanceOf(userTwo.address);
                const saleCratBalanceAfter = await token.balanceOf(sale.address);
                const userCratBalanceAfter = await token.balanceOf(userOne.address);

                const fatherAddressAfterTwo = await sale.userInfo(userOne.address);
                expect(fatherAddressAfterTwo.referralFather).to.equal(userTwo.address);

                expect(saleUsdtBalanceBefore.add(underlyingSaleAmount)).to.equal(saleUsdtBalanceAfter);
                expect(userUsdtBalanceBefore.sub(stableAmount)).to.equal(userUsdtBalanceAfter);
                expect(fatherUsdtBalanceBefore.add(craftRefundAmount)).to.equal(fatherUsdtBalanceAfter);
                expect(saleCratBalanceBefore.sub(craftTotalTokensAmount)).to.equal(saleCratBalanceAfter);
                expect(userCratBalanceBefore.add(craftTotalTokensAmount)).to.equal(userCratBalanceAfter);
            });

            it("Should not change father address after setup", async function () {
                const { token, sale, usdt, userOne, userTwo, admin } = await loadFixture(deployCrowdsaleFixture);

                const zeroAddress = ethers.constants.AddressZero;
                const fatherAddressBefore = await sale.userInfo(userOne.address);
                expect(fatherAddressBefore.referralFather).to.equal(zeroAddress);

                const stableAmountTwo = withDecimals("100");

                await usdt.connect(userTwo).approve(sale.address, stableAmountTwo);
                await sale.connect(userTwo).buyCratTokens(usdt.address, stableAmountTwo, userTwo.address, await sale.calculateReferralRefundAmount(userTwo.address, userTwo.address, stableAmountTwo));

                const stableAmountOne = withDecimals("100");

                await usdt.connect(userOne).approve(sale.address, stableAmountOne);
                await sale.connect(userOne).buyCratTokens(usdt.address, stableAmountOne, userTwo.address, await sale.calculateReferralRefundAmount(userOne.address, userTwo.address, stableAmountOne));

                const fatherAddressAfter = await sale.userInfo(userOne.address);
                expect(fatherAddressAfter.referralFather).to.equal(userTwo.address);

                const saleUsdtBalanceBefore = await usdt.balanceOf(sale.address);
                const userUsdtBalanceBefore = await usdt.balanceOf(userOne.address);
                const fatherUsdtBalanceBefore = await usdt.balanceOf(userTwo.address);
                const saleCratBalanceBefore = await token.balanceOf(sale.address);
                const userCratBalanceBefore = await token.balanceOf(userOne.address);

                const tokensToBuy = withDecimals("2000");
                const craftStableAmount = withDecimals("400");
                const craftRefundAmount = withDecimals("40");
                const craftBonusStablesAmount = withDecimals("10");
                const craftBonusTokensAmount = withDecimals("50");
                const stableAmount = await sale.calculateStableAmount(tokensToBuy);
                const craftTotalTokensAmount = tokensToBuy.add(craftBonusTokensAmount);
                const bonusTokensAmount = await sale.calculateTokensAmount(craftBonusStablesAmount);
                const underlyingSaleAmount = stableAmount.sub(craftRefundAmount);

                expect(stableAmount).to.equal(craftStableAmount);
                expect(craftBonusTokensAmount).to.equal(bonusTokensAmount);

                await usdt.connect(userOne).approve(sale.address, stableAmount);
                await sale.connect(userOne).buyCratTokens(usdt.address, stableAmount, admin.address, await sale.calculateReferralRefundAmount(userOne.address, admin.address, stableAmount));

                const saleUsdtBalanceAfter = await usdt.balanceOf(sale.address);
                const userUsdtBalanceAfter = await usdt.balanceOf(userOne.address);
                const fatherUsdtBalanceAfter = await usdt.balanceOf(userTwo.address);
                const saleCratBalanceAfter = await token.balanceOf(sale.address);
                const userCratBalanceAfter = await token.balanceOf(userOne.address);

                const fatherAddressAfterTwo = await sale.userInfo(userOne.address);
                expect(fatherAddressAfterTwo.referralFather).to.equal(userTwo.address);

                expect(saleUsdtBalanceBefore.add(underlyingSaleAmount)).to.equal(saleUsdtBalanceAfter);
                expect(userUsdtBalanceBefore.sub(stableAmount)).to.equal(userUsdtBalanceAfter);
                expect(fatherUsdtBalanceBefore.add(craftRefundAmount)).to.equal(fatherUsdtBalanceAfter);
                expect(saleCratBalanceBefore.sub(craftTotalTokensAmount)).to.equal(saleCratBalanceAfter);
                expect(userCratBalanceBefore.add(craftTotalTokensAmount)).to.equal(userCratBalanceAfter);
            });

            it("Should right balances father wrong address", async function () {
                const { token, sale, usdt, userOne, userTwo } = await loadFixture(deployCrowdsaleFixture);

                const zeroAddress = ethers.constants.AddressZero;
                const fatherAddressBefore = await sale.userInfo(userOne.address);
                expect(fatherAddressBefore.referralFather).to.equal(zeroAddress);

                const stableAmountTwo = withDecimals("100");

                await usdt.connect(userTwo).approve(sale.address, stableAmountTwo);
                await sale.connect(userTwo).buyCratTokens(usdt.address, stableAmountTwo, userTwo.address, await sale.calculateReferralRefundAmount(userTwo.address, userTwo.address, stableAmountTwo));

                const stableAmountOne = withDecimals("100");

                await usdt.connect(userOne).approve(sale.address, stableAmountOne);
                await sale.connect(userOne).buyCratTokens(usdt.address, stableAmountOne, userTwo.address, await sale.calculateReferralRefundAmount(userOne.address, userTwo.address, stableAmountOne));

                const fatherAddressAfter = await sale.userInfo(userOne.address);
                expect(fatherAddressAfter.referralFather).to.equal(userTwo.address);

                const saleUsdtBalanceBefore = await usdt.balanceOf(sale.address);
                const userUsdtBalanceBefore = await usdt.balanceOf(userOne.address);
                const fatherUsdtBalanceBefore = await usdt.balanceOf(userTwo.address);
                const saleCratBalanceBefore = await token.balanceOf(sale.address);
                const userCratBalanceBefore = await token.balanceOf(userOne.address);

                const tokensToBuy = withDecimals("2000");
                const craftStableAmount = withDecimals("400");
                const craftRefundAmount = withDecimals("40");
                const craftBonusStablesAmount = withDecimals("10");
                const craftBonusTokensAmount = withDecimals("50");
                const stableAmount = await sale.calculateStableAmount(tokensToBuy);
                const craftTotalTokensAmount = tokensToBuy.add(craftBonusTokensAmount);
                const bonusTokensAmount = await sale.calculateTokensAmount(craftBonusStablesAmount);
                const underlyingSaleAmount = stableAmount.sub(craftRefundAmount);

                expect(stableAmount).to.equal(craftStableAmount);
                expect(craftBonusTokensAmount).to.equal(bonusTokensAmount);

                await usdt.connect(userOne).approve(sale.address, stableAmount);
                await sale.connect(userOne).buyCratTokens(usdt.address, stableAmount, userOne.address, await sale.calculateReferralRefundAmount(userOne.address, userOne.address, stableAmount));

                const saleUsdtBalanceAfter = await usdt.balanceOf(sale.address);
                const userUsdtBalanceAfter = await usdt.balanceOf(userOne.address);
                const fatherUsdtBalanceAfter = await usdt.balanceOf(userTwo.address);
                const saleCratBalanceAfter = await token.balanceOf(sale.address);
                const userCratBalanceAfter = await token.balanceOf(userOne.address);

                const fatherAddressAfterTwo = await sale.userInfo(userOne.address);
                expect(fatherAddressAfterTwo.referralFather).to.equal(userTwo.address);

                expect(saleUsdtBalanceBefore.add(underlyingSaleAmount)).to.equal(saleUsdtBalanceAfter);
                expect(userUsdtBalanceBefore.sub(stableAmount)).to.equal(userUsdtBalanceAfter);
                expect(fatherUsdtBalanceBefore.add(craftRefundAmount)).to.equal(fatherUsdtBalanceAfter);
                expect(saleCratBalanceBefore.sub(craftTotalTokensAmount)).to.equal(saleCratBalanceAfter);
                expect(userCratBalanceBefore.add(craftTotalTokensAmount)).to.equal(userCratBalanceAfter);
            });

            it("Should right father address", async function () {
                const { sale, usdt, userOne, userTwo, userBalance } = await loadFixture(deployCrowdsaleFixture);

                const zeroAddress = ethers.constants.AddressZero;
                await usdt.connect(userOne).approve(sale.address, userBalance);
                await usdt.connect(userTwo).approve(sale.address, userBalance);

                const amountToBuy = withDecimals("100");

                await sale.connect(userOne).buyCratTokens(usdt.address, amountToBuy, zeroAddress, await sale.calculateReferralRefundAmount(userOne.address, zeroAddress, amountToBuy));
                await sale.connect(userOne).buyCratTokens(usdt.address, amountToBuy, userOne.address, await sale.calculateReferralRefundAmount(userOne.address, userOne.address, amountToBuy));
                await sale.connect(userOne).buyCratTokens(usdt.address, amountToBuy, sale.address, await sale.calculateReferralRefundAmount(userOne.address, sale.address, amountToBuy));
                await sale.connect(userOne).buyCratTokens(usdt.address, amountToBuy, userTwo.address, await sale.calculateReferralRefundAmount(userOne.address, userTwo.address, amountToBuy));

                await sale.connect(userTwo).buyCratTokens(usdt.address, amountToBuy, userTwo.address, await sale.calculateReferralRefundAmount(userTwo.address, userTwo.address, amountToBuy));

                await sale.connect(userOne).buyCratTokens(usdt.address, amountToBuy, userTwo.address, await sale.calculateReferralRefundAmount(userOne.address, userTwo.address, amountToBuy));
                await sale.connect(userOne).buyCratTokens(usdt.address, amountToBuy, zeroAddress, await sale.calculateReferralRefundAmount(userOne.address, zeroAddress, amountToBuy));
                await sale.connect(userOne).buyCratTokens(usdt.address, amountToBuy, userOne.address, await sale.calculateReferralRefundAmount(userOne.address, userOne.address, amountToBuy));
                await sale.connect(userOne).buyCratTokens(usdt.address, amountToBuy, sale.address, await sale.calculateReferralRefundAmount(userOne.address, sale.address, amountToBuy));

                const userInfo = await sale.userInfo(userOne.address);
                expect(userInfo.referralFather).to.equal(sale.address);
            });
        });
    });

    describe("CalculateStableAmount", function () {
        it("Should calculate right stable amount to buy 100 tokens", async function () {
            const { sale } = await loadFixture(deployCrowdsaleFixture);

            const tokensToBuy = withDecimals("100");
            const craftStableAmount = withDecimals("20");

            expect(await sale.calculateStableAmount(tokensToBuy)).to.equal(craftStableAmount);
        });

        it("Should calculate right stable amount to buy 1 tokens", async function () {
            const { sale } = await loadFixture(deployCrowdsaleFixture);

            const tokensToBuy = withDecimals("1");
            const craftStableAmount = withDecimals("0.2");

            expect(await sale.calculateStableAmount(tokensToBuy)).to.equal(craftStableAmount);
        });

        it("Should calculate right stable amount to buy 0,(e17)5 tokens", async function () {
            const { sale } = await loadFixture(deployCrowdsaleFixture);

            const tokensToBuy = 5;
            const craftStableAmount = 1;

            expect(await sale.calculateStableAmount(tokensToBuy)).to.equal(craftStableAmount);
        });

        it("Should calculate right stable amount to buy 0,(e17)4 tokens", async function () {
            const { sale } = await loadFixture(deployCrowdsaleFixture);

            const tokensToBuy = 4;
            const craftStableAmount = 0;

            expect(await sale.calculateStableAmount(tokensToBuy)).to.equal(craftStableAmount);
        });

        it("Should calculate right stable amount to buy 1000 tokens", async function () {
            const { sale } = await loadFixture(deployCrowdsaleFixture);

            const tokensToBuy = withDecimals("1000");
            const craftStableAmount = withDecimals("200");

            expect(await sale.calculateStableAmount(tokensToBuy)).to.equal(craftStableAmount);
        });

        it("Should calculate right stable amount to buy 50000 tokens", async function () {
            const { sale } = await loadFixture(deployCrowdsaleFixture);

            const tokensToBuy = withDecimals("50000");
            const craftStableAmount = withDecimals("10000");

            expect(await sale.calculateStableAmount(tokensToBuy)).to.equal(craftStableAmount);
        });
    });

    describe("CalculateTokensAmount", function () {
        it("Should calculate right tokens amount to spend 100 stables", async function () {
            const { sale } = await loadFixture(deployCrowdsaleFixture);

            const stablesToSpend = withDecimals("100");
            const craftTokenAmount = withDecimals("500");

            expect(await sale.calculateTokensAmount(stablesToSpend)).to.equal(craftTokenAmount);
        });

        it("Should calculate right tokens amount to spend 1 stables", async function () {
            const { sale } = await loadFixture(deployCrowdsaleFixture);

            const stablesToSpend = withDecimals("1");
            const craftTokenAmount = withDecimals("5");

            expect(await sale.calculateTokensAmount(stablesToSpend)).to.equal(craftTokenAmount);
        });

        it("Should calculate right tokens amount to spend 0,(e17)1 stables", async function () {
            const { sale } = await loadFixture(deployCrowdsaleFixture);

            const stablesToSpend = 1;
            const craftTokenAmount = 5;

            expect(await sale.calculateTokensAmount(stablesToSpend)).to.equal(craftTokenAmount);
        });

        it("Should calculate right tokens amount to spend 1000 stables", async function () {
            const { sale } = await loadFixture(deployCrowdsaleFixture);

            const stablesToSpend = withDecimals("1000");
            const craftTokenAmount = withDecimals("5000");

            expect(await sale.calculateTokensAmount(stablesToSpend)).to.equal(craftTokenAmount);
        });

        it("Should calculate right tokens amount to spend 10000 stables", async function () {
            const { sale } = await loadFixture(deployCrowdsaleFixture);

            const stablesToSpend = withDecimals("10000");
            const craftTokenAmount = withDecimals("50000");

            expect(await sale.calculateTokensAmount(stablesToSpend)).to.equal(craftTokenAmount);
        });
    });

    describe("Price", function () {
        describe("Instant update price by one payment", function () {
            it("Should update price after first price tier achieved", async function () {
                const tokensToBuy = withDecimals("500000");
                const priceTarget = withDecimals("0.22");

                await updatePriceOnePayment(tokensToBuy, priceTarget);
            });

            it("Should update price after second price tier achieved", async function () {
                const tokensToBuy = withDecimals("1000000");
                const priceTarget = withDecimals("0.23");

                await updatePriceOnePayment(tokensToBuy, priceTarget);
            });

            it("Should update price after third price tier achieved", async function () {
                const tokensToBuy = withDecimals("1500000");
                const priceTarget = withDecimals("0.24");

                await updatePriceOnePayment(tokensToBuy, priceTarget);
            });

            it("Should update price after fourth price tier achieved", async function () {
                const tokensToBuy = withDecimals("2000000");
                const priceTarget = withDecimals("0.25");

                await updatePriceOnePayment(tokensToBuy, priceTarget);
            });

            it("Should update price after fifth price tier achieved", async function () {
                const tokensToBuy = withDecimals("2500000");
                const priceTarget = withDecimals("0.26");

                await updatePriceOnePayment(tokensToBuy, priceTarget);
            });

            it("Should update price after sixth price tier achieved", async function () {
                const tokensToBuy = withDecimals("3000000");
                const priceTarget = withDecimals("0.27");

                await updatePriceOnePayment(tokensToBuy, priceTarget);
            });

            it("Should update price after seventh price tier achieved", async function () {
                const tokensToBuy = withDecimals("3500000");
                const priceTarget = withDecimals("0.28");

                await updatePriceOnePayment(tokensToBuy, priceTarget);
            });

            it("Should update price after eighth price tier achieved", async function () {
                const tokensToBuy = withDecimals("4000000");
                const priceTarget = withDecimals("0.29");

                await updatePriceOnePayment(tokensToBuy, priceTarget);
            });

            it("Should update price after ninth price tier achieved", async function () {
                const tokensToBuy = withDecimals("4500000");
                const priceTarget = withDecimals("0.30");

                await updatePriceOnePayment(tokensToBuy, priceTarget);
            });

            it("Should update max price after ninth price tier achieved over payment", async function () {
                const tokensToBuy = withDecimals("4965000");
                const priceTarget = withDecimals("0.30");

                await updatePriceOnePayment(tokensToBuy, priceTarget);
            });
        });

        describe("Update price by multi payments", function () {
            it("Should update price every payment to 0.25", async function () {
                const tokensToBuyOne = withDecimals("750000");
                const tokensToBuyTwo = withDecimals("318181");
                const tokensToBuyThree = withDecimals("416666");
                const tokensToBuyFour = withDecimals("576923");
                const finishPriceTarget = withDecimals("0.25");

                await updatePriceMultiPayments(tokensToBuyOne, tokensToBuyTwo, tokensToBuyThree, tokensToBuyFour, finishPriceTarget);
            });

            it("Should update price every payment to 0.27", async function () {
                const tokensToBuyOne = withDecimals("1100000");
                const tokensToBuyTwo = withDecimals("625000");
                const tokensToBuyThree = withDecimals("576923");
                const tokensToBuyFour = withDecimals("635714");
                const finishPriceTarget = withDecimals("0.27");

                await updatePriceMultiPayments(tokensToBuyOne, tokensToBuyTwo, tokensToBuyThree, tokensToBuyFour, finishPriceTarget);
            });

            it("Should update price every payment to 0.29", async function () {
                const tokensToBuyOne = withDecimals("1100000");
                const tokensToBuyTwo = withDecimals("825000");
                const tokensToBuyThree = withDecimals("676923");
                const tokensToBuyFour = withDecimals("1050000");
                const finishPriceTarget = withDecimals("0.29");

                await updatePriceMultiPayments(tokensToBuyOne, tokensToBuyTwo, tokensToBuyThree, tokensToBuyFour, finishPriceTarget);
            });

            it("Should update price every payment to 0.30", async function () {
                const tokensToBuyOne = withDecimals("1300000");
                const tokensToBuyTwo = withDecimals("925000");
                const tokensToBuyThree = withDecimals("876923");
                const tokensToBuyFour = withDecimals("1450000");
                const finishPriceTarget = withDecimals("0.30");

                await updatePriceMultiPayments(tokensToBuyOne, tokensToBuyTwo, tokensToBuyThree, tokensToBuyFour, finishPriceTarget);
            });

            it("Should update over price every payment to 0.30", async function () {
                const tokensToBuyOne = withDecimals("1400000");
                const tokensToBuyTwo = withDecimals("1025000");
                const tokensToBuyThree = withDecimals("976923");
                const tokensToBuyFour = withDecimals("1250000");
                const finishPriceTarget = withDecimals("0.30");

                await updatePriceMultiPayments(tokensToBuyOne, tokensToBuyTwo, tokensToBuyThree, tokensToBuyFour, finishPriceTarget);
            });

            it("Should wont update price every payment", async function () {
                const tokensToBuyOne = withDecimals("110000");
                const tokensToBuyTwo = withDecimals("110000");
                const tokensToBuyThree = withDecimals("110000");
                const tokensToBuyFour = withDecimals("110000");
                const finishPriceTarget = withDecimals("0.20");

                await updatePriceMultiPayments(tokensToBuyOne, tokensToBuyTwo, tokensToBuyThree, tokensToBuyFour, finishPriceTarget);
            });
        });
    });

    describe("Change refund interest", function () {
        it("Should only be available while paused", async function () {
            const { sale, admin } = await loadFixture(deployCrowdsaleFixture);

            const newInterest = 1;
            await expect(sale.connect(admin).changeRefundInterest(newInterest)).to.be.revertedWith(
                "Pausable: not paused"
            );
            await sale.connect(admin).pause();
            await sale.connect(admin).changeRefundInterest(newInterest);
            expect(await sale.referralRefundInterest()).equal(newInterest);
        });

        it("Should revert change wrong value", async function () {
            const { sale, admin } = await loadFixture(deployCrowdsaleFixture);

            await sale.connect(admin).pause();
            const newInterest = 10001;
            await expect(sale.connect(admin).changeRefundInterest(newInterest)).to.be.revertedWith(
                "CratCrowdsale: invalid new refund interest value"
            );
        });

        it("Should pass change zero value", async function () {
            const { sale, admin } = await loadFixture(deployCrowdsaleFixture);

            await sale.connect(admin).pause();
            const maxInterest = await sale.MAX_REFUND_INTEREST();
            const initInterest = await sale.referralRefundInterest();

            expect(initInterest).to.equal(1000);
            expect(maxInterest).to.equal(10000);

            const newInterest = 0;
            await sale.connect(admin).changeRefundInterest(newInterest);
            const interest = await sale.referralRefundInterest();

            expect(interest).to.equal(newInterest);
        });

        it("Should right balances after changed interest rate 50%", async function () {
            const { sale, usdt, userOne, userTwo, admin } = await loadFixture(deployCrowdsaleFixture);

            const fatherAmountToPay = withDecimals("1");
            await usdt.connect(userTwo).approve(sale.address, fatherAmountToPay);
            await sale.connect(userTwo).buyCratTokens(usdt.address, fatherAmountToPay, userOne.address, await sale.calculateReferralRefundAmount(userTwo.address, userOne.address, fatherAmountToPay));

            const saleUsdtBalanceBefore = await usdt.balanceOf(sale.address);
            const userUsdtBalanceBefore = await usdt.balanceOf(userOne.address);
            const fatherUsdtBalanceBefore = await usdt.balanceOf(userTwo.address);
            const totalRaisedBefore = await sale.totalFundsRaised();
            const userInfoBefore = await sale.userInfo(userTwo.address);

            expect(userInfoBefore.referralReceived).to.equal(0);

            const stablesToPay = withDecimals("1000");
            const craftBonusTokensAmount = withDecimals("150");
            const craftBonusStablesAmount = withDecimals("30");
            const craftTokensAmount = withDecimals("5000")
            const tokensAmount = await sale.calculateTokensAmount(stablesToPay);
            const bonusTokensAmount = await sale.calculateTokensAmount(craftBonusStablesAmount)

            expect(tokensAmount).to.equal(craftTokensAmount);
            expect(craftBonusTokensAmount).to.equal(bonusTokensAmount);
            expect(totalRaisedBefore).to.equal(fatherAmountToPay);

            const newRate = 5000;
            const stablesToRefund = withDecimals("500");

            await sale.connect(admin).pause();
            await sale.connect(admin).changeRefundInterest(newRate);
            await sale.connect(admin).unpause();
            await usdt.connect(userOne).approve(sale.address, stablesToPay);
            await sale.connect(userOne).buyCratTokens(usdt.address, stablesToPay, userTwo.address, await sale.calculateReferralRefundAmount(userOne.address, userTwo.address, stablesToPay));

            const saleUsdtBalanceAfter = await usdt.balanceOf(sale.address);
            const userUsdtBalanceAfter = await usdt.balanceOf(userOne.address);
            const fatherUsdtBalanceAfter = await usdt.balanceOf(userTwo.address);
            const totalRaisedAfter = await sale.totalFundsRaised();
            const userInfoAfter = await sale.userInfo(userTwo.address);

            expect(userInfoAfter.referralReceived).to.equal(stablesToRefund);
            expect(totalRaisedAfter).to.equal(stablesToPay.add(fatherAmountToPay));
            expect(saleUsdtBalanceBefore.add(stablesToRefund)).to.equal(saleUsdtBalanceAfter);
            expect(userUsdtBalanceBefore.sub(stablesToPay)).to.equal(userUsdtBalanceAfter);
            expect(fatherUsdtBalanceBefore.add(stablesToRefund)).to.equal(fatherUsdtBalanceAfter);
        });

        it("Should right balances after changed interest rate 100%", async function () {
            const { sale, usdt, userOne, userTwo, admin } = await loadFixture(deployCrowdsaleFixture);

            const fatherAmountToPay = withDecimals("1");
            await usdt.connect(userTwo).approve(sale.address, fatherAmountToPay);
            await sale.connect(userTwo).buyCratTokens(usdt.address, fatherAmountToPay, userOne.address, await sale.calculateReferralRefundAmount(userTwo.address, userOne.address, fatherAmountToPay));

            const saleUsdtBalanceBefore = await usdt.balanceOf(sale.address);
            const userUsdtBalanceBefore = await usdt.balanceOf(userOne.address);
            const fatherUsdtBalanceBefore = await usdt.balanceOf(userTwo.address);
            const totalRaisedBefore = await sale.totalFundsRaised();
            const userInfoBefore = await sale.userInfo(userTwo.address);

            expect(userInfoBefore.referralReceived).to.equal(0);

            const stablesToPay = withDecimals("1000");
            const craftBonusTokensAmount = withDecimals("150");
            const craftBonusStablesAmount = withDecimals("30");
            const craftTokensAmount = withDecimals("5000")
            const tokensAmount = await sale.calculateTokensAmount(stablesToPay);
            const bonusTokensAmount = await sale.calculateTokensAmount(craftBonusStablesAmount)

            expect(tokensAmount).to.equal(craftTokensAmount);
            expect(craftBonusTokensAmount).to.equal(bonusTokensAmount);
            expect(totalRaisedBefore).to.equal(fatherAmountToPay);

            const newRate = 10000;
            const stablesToRefund = withDecimals("1000");

            await sale.connect(admin).pause();
            await sale.connect(admin).changeRefundInterest(newRate);
            await sale.connect(admin).unpause();
            await usdt.connect(userOne).approve(sale.address, stablesToPay);
            await sale.connect(userOne).buyCratTokens(usdt.address, stablesToPay, userTwo.address, await sale.calculateReferralRefundAmount(userOne.address, userTwo.address, stablesToPay));

            const saleUsdtBalanceAfter = await usdt.balanceOf(sale.address);
            const userUsdtBalanceAfter = await usdt.balanceOf(userOne.address);
            const fatherUsdtBalanceAfter = await usdt.balanceOf(userTwo.address);
            const totalRaisedAfter = await sale.totalFundsRaised();
            const userInfoAfter = await sale.userInfo(userTwo.address);

            expect(userInfoAfter.referralReceived).to.equal(stablesToRefund);
            expect(totalRaisedAfter).to.equal(stablesToPay.add(fatherAmountToPay));
            expect(saleUsdtBalanceBefore).to.equal(saleUsdtBalanceAfter);
            expect(userUsdtBalanceBefore.sub(stablesToPay)).to.equal(userUsdtBalanceAfter);
            expect(fatherUsdtBalanceBefore.add(stablesToRefund)).to.equal(fatherUsdtBalanceAfter);
        });
    });

    describe("Pause", function () {
        it("Should not paused after deploy", async function () {
            const { sale } = await loadFixture(deployCrowdsaleFixture);

            const paused = await sale.paused();
            expect(paused).to.equal(false);
        });

        it("Should pass pause after deploy", async function () {
            const { sale, admin } = await loadFixture(deployCrowdsaleFixture);

            await sale.connect(admin).pause();
            const paused = await sale.paused();
            expect(paused).to.equal(true);
        });

        it("Should pass call buy while not paused", async function () {
            const { token, sale, userOne, usdt } = await loadFixture(deployCrowdsaleFixture);

            const paused = await sale.paused();
            expect(paused).to.equal(false);

            const cratBalanceBefore = await token.balanceOf(userOne.address);
            const stableAmount = withDecimals("100");
            const tokensToBuy = await sale.calculateTokensAmount(stableAmount);

            await usdt.connect(userOne).approve(sale.address, stableAmount);
            await sale.connect(userOne).buyCratTokens(usdt.address, stableAmount, userOne.address, 0);

            const cratBalanceAfter = await token.balanceOf(userOne.address);

            expect(cratBalanceBefore.add(tokensToBuy)).to.equal(cratBalanceAfter);
        });

        it("Should revert buy while paused", async function () {
            const { token, sale, admin, userOne, usdt } = await loadFixture(deployCrowdsaleFixture);

            const paused = await sale.paused();
            expect(paused).to.equal(false);
            await sale.connect(admin).pause();
            const pausedAfter = await sale.paused();
            expect(pausedAfter).to.equal(true);

            const cratBalanceBefore = await token.balanceOf(userOne.address);
            const stableAmount = withDecimals("100");
            const tokensToBuy = withDecimals("1");

            await usdt.connect(userOne).approve(sale.address, stableAmount);
            await expect(sale.connect(userOne).buyCratTokens(usdt.address, tokensToBuy, userOne.address, 0)).to.be.revertedWith(
                "Pausable: paused"
            );

            const cratBalanceAfter = await token.balanceOf(userOne.address);

            expect(cratBalanceBefore).to.equal(cratBalanceAfter);
        });

        it("Should revert pause while paused", async function () {
            const { sale, admin } = await loadFixture(deployCrowdsaleFixture);

            const paused = await sale.paused();
            expect(paused).to.equal(false);
            await sale.connect(admin).pause();
            const pausedAfter = await sale.paused();
            expect(pausedAfter).to.equal(true);

            await expect(sale.connect(admin).pause()).to.be.revertedWith(
                "Pausable: paused"
            );
        });
    });

    describe("Ownable", function () {
        it("Should right owner after deploy", async function () {
            const { sale, admin } = await loadFixture(deployCrowdsaleFixture);

            const owner = await sale.owner();

            expect(owner).to.equal(admin.address);
        });

        it("Should pass transfer ownership ", async function () {
            const { sale, admin, userOne } = await loadFixture(deployCrowdsaleFixture);

            const owner = await sale.owner();
            expect(owner).to.equal(admin.address);

            await sale.connect(admin).transferOwnership(userOne.address);

            const ownerAfter = await sale.owner();
            expect(ownerAfter).to.equal(userOne.address);
        });

        it("Should pass renounce ownership ", async function () {
            const { sale, admin, userOne } = await loadFixture(deployCrowdsaleFixture);

            const zeroAddress = ethers.constants.AddressZero;
            const owner = await sale.owner();
            expect(owner).to.equal(admin.address);

            await sale.connect(admin).renounceOwnership();

            const ownerAfter = await sale.owner();
            expect(ownerAfter).to.equal(zeroAddress);
        });

        it("Should revert withdraw tokens by not an owner", async function () {
            const { sale, userOne, token } = await loadFixture(deployCrowdsaleFixture);

            const amountToWithdraw = withDecimals("1");

            await expect(sale.connect(userOne).withdrawTokens(token.address, userOne.address, amountToWithdraw)).to.be.revertedWith(
                "Ownable: caller is not the owner"
            );
        });

        it("Should revert pause by not an owner", async function () {
            const { sale, userOne } = await loadFixture(deployCrowdsaleFixture);

            await expect(sale.connect(userOne).pause()).to.be.revertedWith(
                "Ownable: caller is not the owner"
            );
        });

        it("Should revert unpause by not an owner", async function () {
            const { sale, userOne, admin } = await loadFixture(deployCrowdsaleFixture);

            await sale.connect(admin).pause();

            await expect(sale.connect(userOne).unpause()).to.be.revertedWith(
                "Ownable: caller is not the owner"
            );
        });

        it("Should revert change interest rate by not an owner", async function () {
            const { sale, userOne, admin } = await loadFixture(deployCrowdsaleFixture);

            await sale.connect(admin).pause();
            const newInterestRate = 1567;

            await expect(sale.connect(userOne).changeRefundInterest(newInterestRate)).to.be.revertedWith(
                "Ownable: caller is not the owner"
            );
        });

        it("Should revert change ownership to zero address", async function () {
            const { sale, admin } = await loadFixture(deployCrowdsaleFixture);

            const zeroAddress = ethers.constants.AddressZero

            await expect(sale.connect(admin).transferOwnership(zeroAddress)).to.be.revertedWith(
                "Ownable: new owner is the zero address"
            );
        });
    });

    describe("WithdrawTokens", function () {
        it("Should pass withdraw stablecoin", async function () {
            const { sale, admin, userOne, usdt } = await loadFixture(deployCrowdsaleFixture);

            const stablesToPay = withDecimals("1000");

            await usdt.connect(userOne).approve(sale.address, stablesToPay);
            await sale.connect(userOne).buyCratTokens(usdt.address, stablesToPay, userOne.address, await sale.calculateReferralRefundAmount(userOne.address, userOne.address, stablesToPay));

            const usdtSaleBalanceBefore = await usdt.balanceOf(sale.address);
            const usdtAdminBalanceBefore = await usdt.balanceOf(admin.address);

            await sale.connect(admin).withdrawTokens(usdt.address, admin.address, stablesToPay);

            const usdtSaleBalanceAfter = await usdt.balanceOf(sale.address);
            const usdtAdminBalanceAfter = await usdt.balanceOf(admin.address);

            expect(usdtSaleBalanceBefore.sub(stablesToPay)).to.equal(usdtSaleBalanceAfter);
            expect(usdtAdminBalanceBefore.add(stablesToPay)).to.equal(usdtAdminBalanceAfter);
        });

        it("Should pass withdraw crat token", async function () {
            const { token, sale, admin } = await loadFixture(deployCrowdsaleFixture);

            const amountToWithdraw = withDecimals("10000");

            const cratSaleBalanceBefore = await token.balanceOf(sale.address);
            const cratAdminBalanceBefore = await token.balanceOf(admin.address);

            await sale.connect(admin).withdrawTokens(token.address, admin.address, amountToWithdraw);

            const cratSaleBalanceAfter = await token.balanceOf(sale.address);
            const cratAdminBalanceAfter = await token.balanceOf(admin.address);

            expect(cratSaleBalanceBefore.sub(amountToWithdraw)).to.equal(cratSaleBalanceAfter);
            expect(cratAdminBalanceBefore.add(amountToWithdraw)).to.equal(cratAdminBalanceAfter);
        });

        it("Should revert withdraw crat token wrong amount", async function () {
            const { token, sale, admin } = await loadFixture(deployCrowdsaleFixture);

            const amountToWithdraw = 0;

            const cratSaleBalanceBefore = await token.balanceOf(sale.address);
            const cratAdminBalanceBefore = await token.balanceOf(admin.address);

            await expect(sale.connect(admin).withdrawTokens(token.address, admin.address, amountToWithdraw)).to.be.revertedWith(
                "CratCrowdsale: invalid amount"
            );

            const cratSaleBalanceAfter = await token.balanceOf(sale.address);
            const cratAdminBalanceAfter = await token.balanceOf(admin.address);

            expect(cratSaleBalanceBefore).to.equal(cratSaleBalanceAfter);
            expect(cratAdminBalanceBefore).to.equal(cratAdminBalanceAfter);
        });

        it("Should revert withdraw stablecoin wrong amount", async function () {
            const { sale, usdc, admin } = await loadFixture(deployCrowdsaleFixture);

            const amountToWithdraw = 0;

            const cratSaleBalanceBefore = await usdc.balanceOf(sale.address);
            const cratAdminBalanceBefore = await usdc.balanceOf(admin.address);

            await expect(sale.connect(admin).withdrawTokens(usdc.address, admin.address, amountToWithdraw)).to.be.revertedWith(
                "CratCrowdsale: invalid amount"
            );

            const cratSaleBalanceAfter = await usdc.balanceOf(sale.address);
            const cratAdminBalanceAfter = await usdc.balanceOf(admin.address);

            expect(cratSaleBalanceBefore).to.equal(cratSaleBalanceAfter);
            expect(cratAdminBalanceBefore).to.equal(cratAdminBalanceAfter);
        });

        it("Should revert withdraw stablecoin wrong balance", async function () {
            const { sale, admin, userOne, usdt, userTwo } = await loadFixture(deployCrowdsaleFixture);

            const stablesToPay = withDecimals("1000");

            await usdt.connect(userTwo).approve(sale.address, stablesToPay);
            await sale.connect(userTwo).buyCratTokens(usdt.address, stablesToPay, userTwo.address, await sale.calculateReferralRefundAmount(userTwo.address, userTwo.address, stablesToPay));

            await usdt.connect(userOne).approve(sale.address, stablesToPay);
            await sale.connect(userOne).buyCratTokens(usdt.address, stablesToPay, userTwo.address, await sale.calculateReferralRefundAmount(userOne.address, userTwo.address, stablesToPay));

            const usdtSaleBalanceBefore = await usdt.balanceOf(sale.address);
            const usdtAdminBalanceBefore = await usdt.balanceOf(admin.address);

            await expect(sale.connect(admin).withdrawTokens(usdt.address, admin.address, stablesToPay.mul(2))).to.be.revertedWith(
                "ERC20: transfer amount exceeds balance"
            );

            const usdtSaleBalanceAfter = await usdt.balanceOf(sale.address);
            const usdtAdminBalanceAfter = await usdt.balanceOf(admin.address);

            expect(usdtSaleBalanceBefore).to.equal(usdtSaleBalanceAfter);
            expect(usdtAdminBalanceBefore).to.equal(usdtAdminBalanceAfter);
        });
    });
});