// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

enum OracleType {
    TEE,
    ZKP
}

struct IntelligentData {
    string dataDescription;
    bytes32 dataHash;
}

struct AccessProof {
    bytes32 oldDataHash;
    bytes32 newDataHash;
    bytes nonce;
    bytes encryptedPubKey;
    bytes proof;
}

struct OwnershipProof {
    OracleType oracleType;
    bytes32 oldDataHash;
    bytes32 newDataHash;
    bytes sealedKey;
    bytes encryptedPubKey;
    bytes nonce;
    bytes proof;
}

struct TransferValidityProof {
    AccessProof accessProof;
    OwnershipProof ownershipProof;
}

interface IERC7857DataVerifier {
    function verifyTransferValidity(
        TransferValidityProof[] calldata _proofs
    ) external returns (bool);
}

contract AgentINFT is ERC721, Ownable {
    uint256 private _nextTokenId;

    struct AgentMetadata {
        string agentType; // "fiat" or "crypto"
        address walletAddress;
        string axlPubkey;
        bytes32 stateHash;
        uint256 createdAt;
        bool isActive;
    }

    mapping(uint256 => AgentMetadata) public agentMetadata;
    mapping(uint256 => IntelligentData[]) public intelligentData;
    mapping(uint256 => address[]) public authorizedUsers;
    mapping(address => uint256[]) public walletToTokens;

    IERC7857DataVerifier public verifier;

    event AgentMinted(
        uint256 indexed tokenId,
        address indexed owner,
        string agentType,
        string axlPubkey
    );
    event AgentStateUpdated(uint256 indexed tokenId, bytes32 newStateHash);
    event Authorization(address indexed from, address indexed to, uint256 indexed tokenId);
    event AuthorizationRevoked(address indexed from, address indexed to, uint256 indexed tokenId);

    constructor() ERC721("Beanstick Agent iNFT", "AGENT") Ownable(msg.sender) {}

    function setVerifier(address _verifier) external onlyOwner {
        verifier = IERC7857DataVerifier(_verifier);
    }

    function mintAgentPair(
        address to,
        address walletAddress,
        string calldata fiatAxlPubkey,
        string calldata cryptoAxlPubkey,
        bytes32 initialStateHash
    ) external onlyOwner returns (uint256 fiatTokenId, uint256 cryptoTokenId) {
        fiatTokenId = _mintAgent(to, walletAddress, "fiat", fiatAxlPubkey, initialStateHash);
        cryptoTokenId = _mintAgent(to, walletAddress, "crypto", cryptoAxlPubkey, initialStateHash);
    }

    function _mintAgent(
        address to,
        address walletAddress,
        string memory agentType,
        string memory axlPubkey,
        bytes32 initialStateHash
    ) internal returns (uint256 tokenId) {
        tokenId = _nextTokenId++;
        _safeMint(to, tokenId);

        agentMetadata[tokenId] = AgentMetadata({
            agentType: agentType,
            walletAddress: walletAddress,
            axlPubkey: axlPubkey,
            stateHash: initialStateHash,
            createdAt: block.timestamp,
            isActive: true
        });

        intelligentData[tokenId].push(IntelligentData({
            dataDescription: string.concat("Agent intelligence: ", agentType),
            dataHash: initialStateHash
        }));

        walletToTokens[walletAddress].push(tokenId);

        emit AgentMinted(tokenId, to, agentType, axlPubkey);
    }

    function updateAgentState(uint256 tokenId, bytes32 newStateHash) external {
        require(ownerOf(tokenId) == msg.sender || owner() == msg.sender, "Not authorized");
        agentMetadata[tokenId].stateHash = newStateHash;

        intelligentData[tokenId].push(IntelligentData({
            dataDescription: "State update",
            dataHash: newStateHash
        }));

        emit AgentStateUpdated(tokenId, newStateHash);
    }

    function authorizeUsage(uint256 tokenId, address user) external {
        require(ownerOf(tokenId) == msg.sender, "Not owner");
        authorizedUsers[tokenId].push(user);
        emit Authorization(msg.sender, user, tokenId);
    }

    function revokeAuthorization(uint256 tokenId, address user) external {
        require(ownerOf(tokenId) == msg.sender, "Not owner");
        address[] storage users = authorizedUsers[tokenId];
        for (uint i = 0; i < users.length; i++) {
            if (users[i] == user) {
                users[i] = users[users.length - 1];
                users.pop();
                emit AuthorizationRevoked(msg.sender, user, tokenId);
                break;
            }
        }
    }

    function intelligentDataOf(uint256 tokenId) external view returns (IntelligentData[] memory) {
        return intelligentData[tokenId];
    }

    function authorizedUsersOf(uint256 tokenId) external view returns (address[] memory) {
        return authorizedUsers[tokenId];
    }

    function getAgentsByWallet(address wallet) external view returns (uint256[] memory) {
        return walletToTokens[wallet];
    }

    function getAgentMetadata(uint256 tokenId) external view returns (AgentMetadata memory) {
        return agentMetadata[tokenId];
    }

    function deactivateAgent(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender || owner() == msg.sender, "Not authorized");
        agentMetadata[tokenId].isActive = false;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(ownerOf(tokenId) != address(0), "Token does not exist");
        AgentMetadata memory meta = agentMetadata[tokenId];

        return string.concat(
            "data:application/json;base64,",
            _base64Encode(bytes(string.concat(
                '{"name":"Beanstick ', meta.agentType, ' Agent #', _toString(tokenId), '",',
                '"description":"Intelligent NFT representing an autonomous trading agent",',
                '"attributes":[{"trait_type":"Agent Type","value":"', meta.agentType, '"},',
                '{"trait_type":"Active","value":"', meta.isActive ? "true" : "false", '"}]}'
            )))
        );
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    function _base64Encode(bytes memory data) internal pure returns (string memory) {
        bytes memory TABLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        uint256 len = data.length;
        if (len == 0) return "";
        uint256 encodedLen = 4 * ((len + 2) / 3);
        bytes memory result = new bytes(encodedLen);
        uint256 i;
        uint256 j;
        for (i = 0; i < len - len % 3; i += 3) {
            uint24 chunk = (uint24(uint8(data[i])) << 16) | (uint24(uint8(data[i+1])) << 8) | uint24(uint8(data[i+2]));
            result[j++] = TABLE[(chunk >> 18) & 0x3F];
            result[j++] = TABLE[(chunk >> 12) & 0x3F];
            result[j++] = TABLE[(chunk >> 6) & 0x3F];
            result[j++] = TABLE[chunk & 0x3F];
        }
        if (len % 3 == 1) {
            uint24 chunk = uint24(uint8(data[i])) << 16;
            result[j++] = TABLE[(chunk >> 18) & 0x3F];
            result[j++] = TABLE[(chunk >> 12) & 0x3F];
            result[j++] = bytes1("=");
            result[j++] = bytes1("=");
        } else if (len % 3 == 2) {
            uint24 chunk = (uint24(uint8(data[i])) << 16) | (uint24(uint8(data[i+1])) << 8);
            result[j++] = TABLE[(chunk >> 18) & 0x3F];
            result[j++] = TABLE[(chunk >> 12) & 0x3F];
            result[j++] = TABLE[(chunk >> 6) & 0x3F];
            result[j++] = bytes1("=");
        }
        return string(result);
    }
}
