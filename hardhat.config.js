require("@nomicfoundation/hardhat-toolbox");
require('dotenv').config();

const {
    PRIVATE_KEY,
    BSC_API_KEY
} = process.env;

module.exports = {
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {},
        bsc: {
            url: "https://bsc-dataseed2.binance.org",
            chainId: 56,
            gasPrice: 5000000000,
            accounts: [PRIVATE_KEY],
        },
        bscTestnet: {
            url: "https://data-seed-prebsc-1-s3.binance.org:8545",
            chainId: 97,
            gasPrice: 10000000000,
            accounts: [PRIVATE_KEY],
        }
    },

    etherscan: {
        apiKey: {
            bsc: BSC_API_KEY,
            bscTestnet: BSC_API_KEY
        }
    },

    solidity: {
        compilers: [
            {
                version: "0.8.19",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
        ],
    },
}