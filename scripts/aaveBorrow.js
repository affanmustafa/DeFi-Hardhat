const { getNamedAccounts, ethers } = require('hardhat');
const { getWeth, AMOUNT } = require('./getWeth');

async function main() {
	// the protocol treats everything as an ERC-20 token
	await getWeth();
	const { deployer } = await getNamedAccounts();
	const signer = await ethers.provider.getSigner();
	// Lending Pool Address Provider: 0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5
	// Lending Pool: ^
	const lendingPool = await getLendingPool(signer);
	const lendingPoolContractAddress = await lendingPool.getAddress();
	console.log(`Lending Pool address ${lendingPoolContractAddress}`);

	//deposit
	// approve the Aave Contract to get WETH token
	const wethTokenAddress = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

	// approve

	await approveErc20(
		wethTokenAddress,
		lendingPoolContractAddress,
		AMOUNT,
		signer
	);
	console.log('Depositing...');
	await lendingPool.deposit(wethTokenAddress, AMOUNT, signer, 0);
	console.log('Deposited');

	// Borrow
	// How much we can borrow, have borrowed and how much we have in collateral
	let { availableBorrowsETH, totalDebtETH } = await getBorrowUserData(
		lendingPool,
		signer
	);
	// availableBorrowsETH depends on the conversion rate of DAI
	const daiPrice = await getDAIPrice();
	const daiPriceNumber = parseFloat(daiPrice.toString());
	const amountDaiToBorrow =
		availableBorrowsETH.toString() * 0.95 * (1 / daiPriceNumber);
	console.log(`You can borrow ${amountDaiToBorrow} DAI`);
	const amountDaiToBorrowWei = ethers.parseEther(amountDaiToBorrow.toString());

	const daiTokenAddress = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
	await borrowDai(daiTokenAddress, lendingPool, amountDaiToBorrowWei, signer);
	await getBorrowUserData(lendingPool, signer);
	await repay(amountDaiToBorrowWei, daiTokenAddress, lendingPool, signer);
	await getBorrowUserData(lendingPool, signer);
}

async function repay(amount, daiAddress, lendingPool, account) {
	await approveErc20(daiAddress, lendingPool.getAddress(), amount, account);
	const repayTx = await lendingPool.repay(daiAddress, amount, 1, account);
	await repayTx.wait(1);
	console.log('Repaid!');
}

async function borrowDai(
	daiAddress,
	lendingPool,
	amountDaiToBorrowWei,
	account
) {
	const borrowTx = await lendingPool.borrow(
		daiAddress,
		amountDaiToBorrowWei,
		1,
		0,
		account
	);
	await borrowTx.wait(1);
	console.log("You've borrowed!");
}

async function getDAIPrice() {
	const daiEthPriceFeed = await ethers.getContractAt(
		'AggregatorV3Interface',
		'0x773616E4d11A78F511299002da57A0a94577F1f4'
	);
	const price = (await daiEthPriceFeed.latestRoundData())[1];
	console.log(`The DAI/ETH price is ${price.toString()}`);
	return price;
}

async function getBorrowUserData(lendingPool, account) {
	const { totalCollateralETH, totalDebtETH, availableBorrowsETH } =
		await lendingPool.getUserAccountData(account);
	console.log(`You have ${totalCollateralETH} worth of ETH deposited`);
	console.log(`You have ${totalDebtETH} worth of ETH borrowed`);
	console.log(`You can borrow ${availableBorrowsETH} worth of ETH`);
	return { availableBorrowsETH, totalDebtETH };
}

async function getLendingPool(account) {
	const lendingPoolAddressesProvider = await ethers.getContractAt(
		'ILendingPoolAddressesProvider',
		'0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5',
		account
	);
	const lendingPoolAddress =
		await lendingPoolAddressesProvider.getLendingPool();
	const lendingPool = await ethers.getContractAt(
		'ILendingPool',
		lendingPoolAddress,
		account
	);
	return lendingPool;
}

async function approveErc20(
	erc20Address,
	spenderAddress,
	amountToSpend,
	account
) {
	const erc20Token = await ethers.getContractAt(
		'IERC20',
		erc20Address,
		account
	);
	const tx = await erc20Token.approve(spenderAddress, amountToSpend);
	await tx.wait(1);
	console.log('Approved!');
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
